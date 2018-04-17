# [Industrial Visual Analysis](https://developer.ibm.com/code/patterns/industrial-visual-analysis/)

In this code pattern, we will identify industrial equipment for various damages upon visual inspection by using machine learning classification techniques.  Using Watson Visual Recognition, we will analyze the image against a trained classifier to inspect oil and gas pipelines with six identifiers - Normal, Burst, Corrosion, Damaged Coating, Joint Failure and Leak. For each image we will provide a percent match with each of the category, on how closely the image matches one of the damaged identifiers or the Normal identifier.  This data can then be used to create a dashboard to the pipelines needing immediate attention to no attention.

The images data is stored in a Cloundant database which makes it easier to connect remote devices (including drones) to capture images.  The database can store different properties of the images like location and description.  This code pattern demonstrates IBM Cloud Functions (OpenWhisk) to trigger microservice as an image is added to the Cloudant database.  The microservice performs the Visual Recognition analysis and updates the Cloudant database with the analysis data.

When the reader has completed this code pattern, they will understand how to:

* Train Visual Recognition to classify images
* Configure Cloudant database to store and retrieve image data
* Set up IBM Cloud Functions to trigger Visual Recognition analysis and store result in Cloudant database
* Launch a web app to view a dashboard of the Visual Recognition analysis, and deploy to IBM Cloud

# Architecture Flow

<p align="center">
  <img width="600"  src="readme_images\arch_flow.png">
</p>

1. User uploads the image through the web UI
2. The image data is send to the Cloudant database
3. As the image is added into the database, the Cloud Functions triggers mircoservice
4. The microservice analyzes the image using the trained Watson Visual Recognition service
5. The analyzed data is fed back into the Cloudant database
6. The dashboard on the web UI displays the Visual Recognition analysis and images requiring attention


## Included Components
+ [Visual Recognition](https://www.ibm.com/watson/services/visual-recognition/)
+ [Cloudant](https://www.ibm.com/analytics/us/en/technology/cloud-data-services/cloudant/)
+ [IBM Cloud Functions](https://console.bluemix.net/openwhisk)


## Featured technologies

- [node js](https://www.python.org/downloads/)
- [curl](https://curl.haxx.se/download.html)

# Running the Application
Follow these steps to setup and run the application. The steps are described in detail below.

## Steps
1. [Watson Visual Recognition Setup](#1-Watson-Visual-Recognition-Setup)
2. [Cloudant NoSQL DB Setup](#2-Cloudant-NoSQL-DB-Setup)
3. [IBM Cloud Functions Setup](#3-IBM-Cloud-Functions-Setup)
4. [Run Web Application](#4-Run-Web-Application)
5. Saves back in Cloudant database
6. Sends it back to the web UI


## 1. Watson Visual Recognition Setup

Create the [Watson Visual Recognition](https://www.ibm.com/watson/services/visual-recognition/) service in IBM Cloud.  You will need the ``API Key``.

Open a command line interface (CLI) on your desktop and clone this repo:
```
git clone https://github.com/IBM/Predictive-Industrial-Visual-Analysis
```

Go to the folder where the images are placed
```
cd Predictive-Industrial-Visual-Analysis/vr-image-data
```

Here we will create a classifier using the zipped images to train the Watson Visual-Recognition service. The images in each zipped folder are used to make the Watson VR service become familiar with the images that relate to the different categories (Corrosion, Leak, etc.). Run the following command to submit all 6 sets of images to the Watson service classifier:

```
curl -X POST -F "Bursted_Pipe_positive_examples=@Burst_Images.zip" -F "Corroded_Pipe_positive_examples=@Corrosion_Images.zip" -F "Damaged_Coating_positive_examples=@Damaged_Coating_Images.zip" -F "Joint_Failure_positive_examples=@Joint_Failure_Images.zip" -F "Pipe_Leak_positive_examples=@Leak_Images.zip" -F "Normal_Condition_positive_examples=@Normal_Condition.zip" -F "name=OilPipeCondition" "https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classifiers?api_key={INSERT-YOUR-API-KEY-HERE}&version=2016-05-20"
```

The response from above will provide you with a status on the submission and will give you a CLASSIFIER_ID. Please copy this for future use as well. After executing the above command, you can view the status of your Watson service and whether it has finished training on the images you submitted. You can check the status like this:

```
curl -X GET "https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classifiers/{INSERT-CLASSIFIER-ID-HERE}?api_key={INSERT-API-KEY-HERE}&version=2016-05-20"
```

You can find more information on working with your classifier [here](https://console.bluemix.net/docs/services/visual-recognition/tutorial-custom-classifier.html#creating-a-custom-classifier)

## 2. Cloudant NoSQL DB Setup

Create the [Cloudant NoSQL](https://www.ibm.com/analytics/us/en/technology/cloud-data-services/cloudant/) service in IBM Cloud.

Create a new database in Cloudant called <strong>image_db</strong>

<p align="center">
  <img width="600"  src="readme_images\cloudant_db.png">
</p>


Next, create a view on the database with the design name ``image_db_images``, index name ``image_db.images``, and use the following map function:
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


## 3. IBM Cloud Functions Setup

We will now set up the IBM Cloud Functions (OpenWhisk) using Bluemix CLI.

#### Setup Bluemix CLI

First download [Bluemix Cli](https://console.bluemix.net/docs/cli/reference/bluemix_cli/download_cli.html#download_install)

Install the Cloud Functions Plugin
```
bx plugin install Cloud-Functions -r Bluemix
```

Log in to IBM Cloud, and target a Region (i.e api.ng.bluemix.net), Organization (i.e Raheel.Zubairy) and Space (i.e dev).
```
bx login -a {INSERT REGION} -o {INSERT ORGANIZATION} -s {INSERT SPACE}
```

#### API Authentication and Host

We will need the API authentication key and host.

Command to retrieve API host:
```
bx wsk property get --apihost
```

Command to retrieve API authentication key:
```
bx wsk property get --auth
```

#### Configure .env file

You will need to provide credentials to your Cloudant NoSQL database and Watson Visual Recognition service, and Cloud Functions Host/Auth information retrieved in the previous step, into a `.env file`. Copy the sample `.env.example` file using the following command:

```
cp .env.example .env
```

and fill in your credentials and your VR Classifier name.

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
VR_CLASSIFIERS=default,OilPipeCondition_1063693116
#From OpenWhisk Functions Service in IBM Cloud
FUNCTIONS_APIHOST=
FUNCTIONS_AUTHORIZATION=
```

#### Run setup_functions.sh

We will now run the ``setup_functions.sh`` file to set up the microservice which triggers the Visual Recognition analysis as an image is added to the Cloudant database.

```
chmod +x setup_functions.sh
./setup_functions.sh --install
```
The above command will setup the OpenWhisk actions for you, there should be no need to do anything else if you see an Install Complete message with green OK signs in the CLI.


#### Explore IBM Cloud Functions

In IBM Cloud, look for ``Functions`` in ``Catalog``

There you will see a UI to ``Manage`` and ``Monitor`` the service. In addition, it has information for ``Getting Started`` and even ``Develop`` actions.

<p align="center">
  <img width="800"  src="readme_images\cloud_functions_scrnshot.png">
</p>


## 4. Run Web Application

#### Run locally

To run the app, go to the ```Industrial-Visual-Analysis``` folder and run the following commands.

Install the dependencies you application need:

```
npm install
```

Start the application locally:

```
npm start
```

Test your application by going to: [http://localhost:3000/](http://localhost:3000/)

#### Deploy to IBM Cloud

[![](https://raw.githubusercontent.com/IBM/manage-control-device-node-red/master/images/deploy-btn.PNG)](https://console.ng.bluemix.net/devops/setup/deploy/?repository=https://github.com/IBM/Predictive-Industrial-Visual-Analysis)


You can push the app to IBM Cloud by first editing the ```manifest file``` file and then using cloud foundry cli commands.

Edit the `manifest.yml` file in the folder that contains your code and replace with a unique name for your application. The name that you specify determines the application's URL, such as `your-application-name.mybluemix.net`. Additionally - update the service names so they match what you have in IBM Cloud. The relevant portion of the `manifest.yml` file looks like the following:

```
applications:
- path: .
  memory: 1024M
  instances: 1
  domain: mybluemix.net
  name: {industrial-visual-analysis}
  disk_quota: 1024M
  services:
  - {cloudant}
  - {visual-recognition}
```

In the command line use the following command to push the application to IBM Cloud:
```
cf push
```


#### Application

<p align="center">
  <img width="800"  src="readme_images\dashboard_scrnshot.png">
</p>


The app has the following functions:
* The homepage displays a quick dashboard showing the number of images in the Cloudant database and how many of them have Watson VR analysis completed. It will also provide a count of how many images were deemed as "Needing attention" based on the response the Watson service provided when classifying the images.

* You have the ability to see all the images in one single page.

* Click on each image to pull up a detailed page providing information on one single event (image). You will be able to see information on what the Watson Visual Recognition service saw in the image and the confidence levels.  You can continue to train the service by using the thumbs up and thumbs down next to each percent match.

* You can click the ``Upload New Image`` button to send images to the Cloudant database.  There are sample images in the ``sample-images`` folder to try out.

## Extending the pattern with Drone

This code pattern can be extended by adding a Drone to take images. A [DJI drone](http://developer.dji.com/) can be used to capture images and configured to send images to our Cloudant database.  As the image is received by the Cloudant database, the VR analysis and image detail can be displayed through the web UI.

## Troubleshooting

#### Visual Recognition
If you invoke ``GET /classifiers`` with ``verbose=1`` what do you see? If that list is empty, and you get this error message, you should open an IBM Cloud support ticket. If it's not empty, you should use ``DELETE /classifiers/{classifier_id}`` to remove the existing classifier so that you can create your new one.

#### IBM Cloud Functions

The ``setup_functions.sh`` have different commands to uninstall, re-install or update IBM Cloud Functions. And to view the env credentials used by IBM Cloud Functions.

* Uninstall:
```
./setup_functions.sh --uninstall
```

* Re-install:
```
./setup_functions.sh --reinstall
```

* Show env cred:
```
./setup_functions.sh --env
```

* Update:
```
./setup_functions.sh --update
```


#### IBM Cloud application
To troubleshoot your IBM Cloud application, use the logs. To see the logs, run:

```bash
cf logs <application-name> --recent
```

## <h2>Learn more</h2>
<ul>
<li><strong>Artificial Intelligence Code Patterns</strong>: Enjoyed this Code Pattern? Check out our other <a href="https://developer.ibm.com/code/technologies/artificial-intelligence/" rel="nofollow">AI Code Patterns</a>.</li>
<li><strong>Data Analytics Code Patterns</strong>: Enjoyed this Code Pattern? Check out our other <a href="https://developer.ibm.com/code/technologies/data-science/" rel="nofollow">Data Analytics Code Patterns</a></li>
<li><strong>AI and Data Code Pattern Playlist</strong>: Bookmark our <a href="https://www.youtube.com/playlist?list=PLzUbsvIyrNfknNewObx5N7uGZ5FKH0Fde" rel="nofollow">playlist</a> with all of our Code Pattern videos</li>
<li><strong>With Watson</strong>: Want to take your Watson app to the next level? Looking to utilize Watson Brand assets? <a href="https://www.ibm.com/watson/with-watson/" rel="nofollow">Join the With Watson program</a> to leverage exclusive brand, marketing, and tech resources to amplify and accelerate your Watson embedded commercial solution.</li>
<li><strong>Data Science Experience</strong>: Master the art of data science with IBM's <a href="https://datascience.ibm.com/" rel="nofollow">Data Science Experience</a></li>
<li><strong>PowerAI</strong>: Get started or get scaling, faster, with a software distribution for machine learning running on the Enterprise Platform for AI: <a href="https://www.ibm.com/ms-en/marketplace/deep-learning-platform" rel="nofollow">IBM Power Systems</a></li>
<li><strong>Spark on IBM Cloud</strong>: Need a Spark cluster? Create up to 30 Spark executors on IBM Cloud with our <a href="https://console.bluemix.net/catalog/services/apache-spark" rel="nofollow">Spark service</a></li>
<li><strong>Kubernetes on IBM Cloud</strong>: Deliver your apps with the combined the power of <a href="https://www.ibm.com/cloud-computing/bluemix/containers" rel="nofollow">Kubernetes and Docker on IBM Cloud</a></li>
</ul>


# License

[Apache 2.0](LICENSE)
