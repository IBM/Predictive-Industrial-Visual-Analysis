**__스킬 레벨__**: 초급
<br>**__주의__**: 이 레파지토리에서 사용되는 모든 서비스는 Lite 플랜(무료)입니다.

# [산업 설비의 Visual Recognition 분석](https://developer.ibm.com/code/patterns/industrial-visual-analysis/)

*다른 언어로 보기: [English](README.md)*

이 코드 패턴에서는 머신러닝 분류 기술을 사용하여 산업용 장비의 시각적 이미지 검사를 통해 다양한 파손을 검사합니다. Watson Visual Recognition을 사용한 숙련된 분류기로 이미지를 분석하여 정상, 파열, 부식, 손상된 코팅, 공동 실패 및 누출의 6가지 식별자로 오일 및 가스 파이프라인을 검사합니다. 손상 식별자 또는 정상 식별자와 각 이미지의 일치하는 정도를 백분율로 보게됩니다. 이 데이터는 대시보드에서 즉각적인 주의가 필요한 파이프라인이나 정상 파이프라인을 나타내는 데 사용됩니다.

이미지 데이터는 Cloudant 데이터베이스에 저장되는데 이는 원격 디바이스(드론을 포함한)에 연결되어 이미지 캡처를 더욱 간단하게 합니다. 이 데이터베이스는 위치, 설명과 같은 이미지의 다른 속성들도 저장할 수 있습니다. 이 코드 패턴은 IBM Cloud Functions가 마이크로서비스를 트리거하여 이미지의 형태로 Cloudant 데이터베이스에 추가하는 방법을 보여줍니다. 마이크로서비스는 Visual Recognition 분석을 수행하고 분석된 데이터를 Cloudant 데이터베이스에 업데이트합니다. 

이 코드 패턴을 진행하시면, 다음의 내용을 배울 수 있습니다:

* 이미지를 분류하기 위해 Watson Visual Recognition을 훈련시키기
* 이미지 데이터를 저장 및 검색하도록 Cloudant 데이터베이스 구성하기
* Visual Recognition 분석 결과를 트리거하여 Cloudant 데이터베이스에 저장하도록 IBM Cloud Functions 설정하기
* Visual Recognition 분석을 대시보드로 보기위한 웹 애플리케이션을 만들고 IBM Cloud 서비스에 배포하기

# 아키텍처 흐름도

<p align="center">
  <img width="600"  src="readme_images\arch_flow.png">
</p>

1. 사용자가 웹 UI를 통해 이미지를 업로드합니다
2. 이미지는 Cloudant 데이터베이스로 전송됩니다
3. 이미지가 데이터베이스에 입력되면서 Cloud Fuctions는 마이크로서비스를 트리거합니다.
4. 마이크로서비스는 훈련된 Watson Visual Recognition 서비스를 사용하여 이미지를 분석합니다
5. 분석된 데이터는 Cloudant 데이터베이스로 회송됩니다
6. 웹 UI 상 대시보드는 시각적 인식의 분석 결과와 주의가 필요한 설비의 이미지를 보여줍니다


## 구성 요소
+ [Visual Recognition](https://www.ibm.com/watson/services/visual-recognition/)
+ [Cloudant](https://www.ibm.com/analytics/us/en/technology/cloud-data-services/cloudant/)
+ [IBM Cloud Functions](https://console.bluemix.net/openwhisk)


## 주요 기술

- [Node.js](https://www.python.org/downloads/)
- [curl](https://curl.haxx.se/download.html)

# 애플리케이션 실행하기
아래의 단계를 따라 애플리케이션을 설정하고 실행하십시오. 단계는 아래에서 자세하게 설명합니다.

## 단계
1. [Watson Visual Recognition 설정하기](#1-Watson-Visual-Recognition-설정하기)
2. [Cloudant NoSQL DB 설정하기](#2-Cloudant-NoSQL-DB-설정하기)
3. [IBM Cloud Functions 설정하기](#3-IBM-Cloud-Functions-설정하기)
4. [Web Application 실행하기](#4-Web-Application-실행하기)

## 1. Watson Visual Recognition 설정하기
IBM Cloud에서 [Watson Visual Recognition](https://www.ibm.com/watson/services/visual-recognition/) 서비스를 생성합니다. ``API Key``가 필요합니다.

* 데스크탑에서 CLI를 열고 이 repo를 복제하십시오:
```
git clone https://github.com/IBM/Predictive-Industrial-Visual-Analysis
```

* 이미지가 있는 폴더로 이동하십시오
```
cd Predictive-Industrial-Visual-Analysis/vr-image-data
```

여기서 압축된 이미지를 사용하여 Watson Visual Recognition 서비스를 훈련시키는 분류자를 생성하고자 합니다. 각 압축 폴더에 있는 이미지는 Watson Visual Recognition 서비스가 서로 다른 범주 (부식, 누출 등)와 관련된 이미지에 익숙해지도록 훈련하는데 사용됩니다. 다음 명령어를 실행하여 6 세트의 이미지를 모두 Watson 서비스 분류자에 제출합니다:

```
curl -X POST -u "apikey:{INSERT-YOUR-IAM-APIKEY-HERE}" -F "Bursted_Pipe_positive_examples=@Burst_Images.zip" -F "Corroded_Pipe_positive_examples=@Corrosion_Images.zip" -F "Damaged_Coating_positive_examples=@Damaged_Coating_Images.zip" -F "Joint_Failure_positive_examples=@Joint_Failure_Images.zip" -F "Pipe_Leak_positive_examples=@Leak_Images.zip" -F "Normal_Condition_positive_examples=@Normal_Condition.zip" -F "name=OilPipeCondition" "https://gateway.watsonplatform.net/visual-recognition/api/v3/classifiers?version=2018-03-19"
```

위의 명령어를 실행하면, 제출에 대한 상태와  `CLASSIFIER_ID`를 확인할 수 있습니다. 나중에 사용하기 위해 이것을 복사해둡니다. 위의 명령어를 실행한 후에는 나의 Watson 서비스의 상태와 제출한 이미지에 대한 훈련의 완료 여부를 확인할 수 있습니다. 아래 명령어를 사용해서 확인해보세요:

```
curl -X GET -u "apikey:{INSERT-YOUR-IAM-APIKEY-HERE}"  "https://gateway.watsonplatform.net/visual-recognition/api/v3/classifiers/{INSERT-CLASSIFIER-ID-HERE}?api_key={INSERT-API-KEY-HERE}&version=2018-03-19"
```

분류자를 사용하는 방법은 [여기를 참조하십시오](https://console.bluemix.net/docs/services/visual-recognition/tutorial-custom-classifier.html#creating-a-custom-classifier)

## 2. Cloudant NoSQL DB 설정하기

IBM Cloud에 [Cloudant NoSQL](https://www.ibm.com/analytics/us/en/technology/cloud-data-services/cloudant/) 서비스를 생성합니다.

Cloudant에 <strong>image_db</strong>라는 새 데이터베이스를 만듭니다. 

<p align="center">
  <img width="600"  src="readme_images\cloudant_db.png">
</p>


그런 다음, 그 데이터베이스에서 디자인 이름이 create a view on the database with the design name ``image_db_images``이고, 인덱스 이름이 ``image_db.images``인 뷰를 만들고 다음 맵 함수를 사용합니다:
```
function (doc) {
if ( doc.type == 'image_db.image' ) {
  emit(doc);
}
}
```

<p align="center">
  <img width="600"  src="readme_images\cloudant_view.png">
</p>


## 3. IBM Cloud Functions 설정하기

이제 Bluemix CLI를 사용하여 IBM Cloud Functions (OpenWhisk)를 설정해봅니다.

#### [Bluemix CLI 설치 및 다운로드](https://console.bluemix.net/docs/cli/reference/bluemix_cli/download_cli.html#download_install)

* Cloud Functions 플러그인 설치하기
```
bx plugin install Cloud-Functions -r Bluemix
```

* IBM Cloud에 로그인하고, 지역 (예: api.ng.bluemix.net), 조직 (예: Raheel.Zubairy) 그리고 영역 (예: dev)을 선택합니다.
```
bx login -a {INSERT REGION} -o {INSERT ORGANIZATION} -s {INSERT SPACE}
```

#### API 인증 및 호스트

API 인증 키와 호스트가 필요합니다.

* API 호스트를 가져오는 명령어:
```
bx wsk property get --apihost
```

* API 인증 키를 가져오는 명령어:
```
bx wsk property get --auth
```

__주의:__ 이 서비스를 생성할 때는 어떤 플랜(Lite 플랜(무료)인지 등)이 연결되어 있는지 확인하세요.


#### .env 파일 구성하기

Cloudant NoSQL 데이터베이스와 Watson Visual Recognition 서비스에 신임정보를 제공하고, 이전 단계의 Cloud Functions Host/Auth 정보를 `.env file`로 가져와야 합니다. 다음 명령어를 사용하여 샘플인 `.env.example` 파일을 복사합니다:

```
cp .env.example .env
```

나의 신임정보와 VR 분류기 이름을 입력합니다.

```
#From cloudant NoSQL database
CLOUDANT_USERNAME=
CLOUDANT_PASSWORD=
CLOUDANT_HOST=
CLOUDANT_URL=
CLOUDANT_DB=image_db
#From Watson Visual Recognition Service
VR_KEY=
VR_URL=
VR_CLASSIFIERS=OilPipeCondition_1063693116
#From OpenWhisk Functions Service in IBM Cloud
FUNCTIONS_APIHOST=
FUNCTIONS_AUTHORIZATION=
```

#### setup_functions.sh 실행

이제 ``setup_functions.sh`` 파일을 실행하여 이미지가 Cloudant 데이터베이스에 추가될 때 Visual Recognition 분석을 트리거하는 마이크로서비스를 설정합니다.

```
chmod +x setup_functions.sh
./setup_functions.sh --install
```
위의 명령어를 실행하면 OpenWhisk 액션이 설정됩니다. CLI에서 초록색 OK라고 설치 완료 메시지가 뜨면 다른 작업을 진행할 필요가 없습니다.


#### IBM Cloud Functions 둘러보기

IBM Cloud의 ``카달로그``에서 ``Functions``를 찾아보세요.  

들어가보시면 서비스를 ``Manage`` 및 ``Monitor``할 수 있는 UI가 있습니다. 또한 ``Getting Started``와 ``Develop`` 액션에 대한 정보를 열람하실 수 있습니다.

<p align="center">
  <img width="800"  src="readme_images\cloud_functions_scrnshot.png">
</p>


## 4. Web Application 실행하기

#### 로컬에서 실행하기

앱을 실행하려면 ```Industrial-Visual-Analysis``` 폴더에서 아래 명령어를 실행합니다.

* 애플리케이션에 필요한 종속성(dependencies)을 설치합니다:

```
npm install
```

* 로컬에서 애플리케이션을 시작합니다:

```
npm start
```

[http://localhost:3000/](http://localhost:3000/)로 이동하여 애플리케이션을 테스트하세요.

#### IBM Cloud에 배포하기

[![Deploy to IBM Cloud](https://bluemix.net/deploy/button.png)](https://bluemix.net/deploy?repository=https://github.com/IBM/Predictive-Industrial-Visual-Analysis)


먼저 ```manifest file```을 편집한 다음 cloud foundry cli 명령을 사용하여 앱을 IBM Cloud로 푸시합니다.

폴더에서 코드가 들어있는 `manifest.yml` 파일을 편집하고, 내가 지은 이름으로 애플리케이션 이름을 변경합니다. 입력하신 이름으로 애플리케이션의 URL - 예를 들면 `내-애플리케이션-이름.mybluemix.net`이 결정됩니다. 또한 서비스 이름을 IBM Cloud에 있는 것과 일치하도록 업데이트합니다. `manifest.yml` 파일의 해당 부분은 다음과 같습니다:

```
applications:
- path: .
  memory: 256M
  instances: 1
  domain: mybluemix.net
  name: {industrial-visual-analysis}
  disk_quota: 1024M
  services:
  - {cloudant-service}
  - {visual-recognition-service}
```

Visual Recognition 서비스의 별칭으로 클라우드 파운드리 서비스를 생성합니다:
```
ibmcloud resource service-alias-create "{visual-recognition-service}" --instance-name "{visual-recognition-service}" -s Dev
```

커맨드 라인에서 다음 명령어를 사용하여 애플리케이션을 IBM Cloud로 푸시합니다:
```
bx app push YOUR_APP_NAME
```


#### 애플리케이션
<p align="center">
  <img width="800"  src="readme_images\dashboard_scrnshot.png">
</p>


이 앱은 다음과 같은 기능을 가지고 있습니다:
* 홈페이지의 대시보드에서는 Cloudant 데이터베이스에 있는 이미지의 수와 그 중 Watson Visual Recognition 분석이 완료되었는지를 볼 수 있습니다. 또한 이미지를 분류할 때 제공된 Watson 서비스의 응답을 기반으로 "주의가 필요함"으로 간주된 이미지의 숫자도 표시됩니다.

* 한 페이지에서 모든 이미지를 볼 수 있습니다.

* 단일 이벤트(이미지)에 대한 정보를 제공하는 자세한 페이지를 보려면 각 이미지를 클릭하십시오. Watson Visual Recognition 서비스가 이미지에서 보았던 정보와 신뢰 수준에 대한 정보를 볼 수 있습니다. 서비스를 계속해서 훈련시키시려면 각 퍼센트 매치 옆의 엄지척 또는 엄지아래를 누르십시오.

* ``Upload New Image`` 버튼을 클릭하여 Cloudant 데이터베이스로 이미지를 보낼 수 있습니다. ``sample-images`` 폴더에 샘플 이미지로 시도해보세요.

## 드론까지 섭렵하기 

이 코드 패턴은 이미지를 촬영하는 드론을 추가할 수도 있습니다. [DJI 드론](http://developer.dji.com/)을 사용하여 이미지를 촬영하여 Cloudant 데이터베이스로 보내도록 설정할 수 있습니다. 이미지가 Cloudant 데이터베이스에 수신되면 VR 분석 및 이미지 세부 정보가 웹 UI에 표시됩니다.

## 문제 해결

#### Visual Recognition
``verbose=1``로 ``GET /classifiers``를 호출하면 무엇이 보이십니까? 만약 리스트가 비어있고 오류 메시지가 뜬다면 IBM Cloud 지원 티켓을 열어야합니다. 리스트가 비어있지 않으면 ``DELETE /classifiers/{classifier_id}``를 사용하여 기존 분류자를 제거하고 새로운 분류자를 만들 수 있습니다.

#### IBM Cloud Functions

``setup_functions.sh``에는 IBM Cloud Functions를 제거하거나 재설치하거나 업데이트하는 명령어들이 있습니다. 또한 IBM Cloud Functions에서 사용하는 환경변수 신임정보를 확인할 수 있습니다.

* 제거하기:
```
./setup_functions.sh --uninstall
```

* 재설치하기:
```
./setup_functions.sh --reinstall
```

* 환경변수 신임정보 보기:
```
./setup_functions.sh --env
```

* 업데이트:
```
./setup_functions.sh --update
```


#### IBM Cloud 애플리케이션
IBM Cloud 애플리케이션의 문제를 해결하려면 로그를 사용합니다. 로그를 보려면 다음을 실행하십시오:

```bash
bx app logs <application-name> --recent
```

## <h2>더 알아보기</h2>
<ul>
<li><strong>AI 코드 패턴</strong>: 이 코드 패턴이 도움이 되었나요? 다른 <a href="https://developer.ibm.com/code/technologies/artificial-intelligence/" rel="nofollow">AI 코드 패턴</a>도 확인해보세요.</li>
<li><strong>데이터 분석 코드 패턴</strong>: 이 코드 패턴이 도움이 되었나요? 다른 <a href="https://developer.ibm.com/code/technologies/data-science/" rel="nofollow">데이터 분석 코드 패턴</a>도 확인해보세요.</li>
<li><strong>AI와 데이터 코드 패턴 플레이리스트</strong>: AI와 데이터 분석에 관심이 있으시다면 <a href="https://www.youtube.com/playlist?list=PLzUbsvIyrNfknNewObx5N7uGZ5FKH0Fde" rel="nofollow">이 플레이리스트</a>를 즐겨찾기 해보세요</li>
<li><strong>With Watson</strong>: Watson 애플리케이션을 다음 단계로 확장하고 싶으십니까? Watson 브랜드 에셋을 찾고 계신가요? <a href="https://www.ibm.com/watson/with-watson/" rel="nofollow">With Watson 프로그램에 가입하여</a> 귀하에게만 제공되는 브랜드, 마케팅 및 기술 리소스를 활용하여 Watson 임베디드 상용 솔루션을 강화하고 가속화하십시오.</li>
<li><strong>Watson Studios</strong>: IBM의 <a href="https://datascience.ibm.com/" rel="nofollow">Watson Studios</a>에서 데이터 사이언스의 정수를 습득하십시오</li>
<li><strong>PowerAI</strong>: AI를 위한 엔터프라이즈 플랫폼인 <a href="https://www.ibm.com/ms-en/marketplace/deep-learning-platform" rel="nofollow">IBM Power Systems</a>에서 머신러닝을 위한 소프트웨어 배포를 시작하거나 확장하고 속도를 높이십시오.</li>



# 라이센스
[Apache 2.0](LICENSE)
