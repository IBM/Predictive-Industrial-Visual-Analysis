# Industrial Visual Analysis

In this developer journey, we will classify industrial equipment through watson visual recognition by analyzing the image against a trained classifier. Here we will be training the visual recognition to classify oil and gas pipelines into six classifications - Normal, Burst, Corrosion, Damaged Coating, Joint Failure and Leak.

The images data is stored in a Cloundant database.  This journey demonstrates Cloud Functions to trigger microservice as an image is added to the Cloudant database.  The microservice performs the Visual Recognition analysis and updates the Cloudant database with the analysis data.

This journey presents the analysis result in a web app with a dashboard showing the attention required for the equipment in each image.

When the reader has completed this journey, they will understand how to:

* Train Visual Recognition to classify images
* Configure Cloudant database to store and retrieve image data
* Set up IBM Cloud Functions to trigger Visual Recognition analysis and store result in Cloudant database
* Launch a web app to view a dashboard of the Visual Recognition analysis, and deploy to Bluemix


# Architecture Flow

<p align="center">
  <img width="60" height="40" src="images\arch_flow.png">
</p>


## Included Components
+ [Visual Recognition](https://www.ibm.com/watson/services/visual-recognition/)
+ [Cloudant](https://www.ibm.com/analytics/us/en/technology/cloud-data-services/cloudant/)
+ [Cloud Functions](https://console.bluemix.net/openwhisk)


## Featured technologies


- [node js](https://www.python.org/downloads/)
- [curl](https://curl.haxx.se/download.html)

# Running the Application
Follow these steps to setup and run this developer journey. The steps are described in detail below.

## Steps
1. [Watson Visual Recognition Setup](#1-Watson-Visual-Recognition-Setup)
2. [Cloudant NoSQL DB Setup](#2-Cloudant-NoSQL-DB-Setup)
3. [IBM Cloud Functions Setup](#3-IBM-Cloud-Functions-Setup)
4. [Run Web Application](#4-Run-Web-Application)



## 1. Watson Visual Recognition Setup

Create the [Watson Visual Recognition](https://www.ibm.com/watson/services/visual-recognition/) service in Bluemix.  You will need the ``API Key``.

Open a command line interface (CLI) on your desktop and clone this repo:
```
git clone https://github.com/IBM/
```

Go to the folder where the images are placed
```
cd Industrial-Visual-Analysis/VR-Image-Data
```

Run the following command to submit all 6 sets of images to the Watson service classifier:

```
curl -X POST -F "Bursted_Pipe_positive_examples=@Burst_Images.zip" -F "Corroded_Pipe_positive_examples=@Corrosion_Images.zip" -F "Damaged_Coating_positive_examples=@Damaged_Coating_Images.zip" -F "Joint_Failure_positive_examples=@Joint_Failure_Images.zip" -F "Pipe_Leak_positive_examples=@Leak_Images.zip" -F "Normal_Condition_positive_examples=@Normal_Condition.zip" -F "name=OilPipeCondition" "https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classifiers?api_key={INSERT-YOUR-API-KEY-HERE}&version=2016-05-20"
```

The above command allows the Watson VR service to become familiar with various images that relate to the different categories (Corrosion, Leak, etc.) .

The response from above will provide you with a status on the submission and will give you a CLASSIFIER_ID. Please copy this for future use as well.

After executing the above command, you can view the status of your Watson service and whether it has finished training on the images you submitted. You can check the status like this:

```
curl -X GET "https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classifiers/{INSERT-CLASSIFIER-ID-HERE}?api_key={INSERT-API-KEY-HERE}&version=2016-05-20"
```

You can find more information on working with your classifier [here](https://console.bluemix.net/docs/services/visual-recognition/tutorial-custom-classifier.html#creating-a-custom-classifier)

## 2. Cloudant NoSQL DB Setup

Create the [Cloudant NoSQL](https://www.ibm.com/analytics/us/en/technology/cloud-data-services/cloudant/) service in Bluemix

Create a new database in Cloudant called <strong>overwatch</strong>

Next, create a view on the database with the index name ``overwatch_images``, and use the following map function:
```
function (doc) {
if ( doc.type == 'overwatch.image' ) {
  emit(doc);
}
}
```

## 3. IBM Cloud Functions Setup

We will now set up the IBM Cloud Functions using Bluemix CLI.

#### Setup Bluemix CLI

First download [Bluemix Cli](https://console.bluemix.net/docs/cli/reference/bluemix_cli/download_cli.html#download_install)

Install the Cloud Functions Plugin
```
bx plugin install Cloud-Functions -r Bluemix
```

Log in to Bluemix, and target a Region (i.e api.ng.bluemix.net), Organization (i.e Raheel.Zubairy) and Space (i.e dev).
```
bx login -a {INSERT REGION} -o {INSERT ORGANIZATION} -s {INSERT SPACE}
```

#### Configure .env file

You will need to provide credentials to your Cloudant NoSQL database and Watson Visual Recognition service and Cloud Functions Host/Auth information in a `.env file`. Copy the sample `.env.example` file using the following command:

```
cp .env.example .env
```

and fill in your credentials.

```
#From cloudant NoSQL database
CLOUDANT_USERNAME=
CLOUDANT_PASSWORD=
CLOUDANT_HOST=
CLOUDANT_URL=
CLOUDANT_DB=overwatch
#From Watson Visual Recognition Service
VR_KEY=
VR_URL=
VR_CLASSIFIERS=default,OilPipeCondition
#From OpenWhisk Functions Service in Bluemix
FUNCTIONS_APIHOST=
FUNCTIONS_AUTHORIZATION=
```

#### Run setup_functions.sh


We will now run the ``setup_functions.sh`` file to set up the microservice which triggers the Visual Recognition analysis as an image is added to the Cloudant database.

```
chmod +x skylink.sh
./setup_functions.sh --install
```
The above command will setup the OpenWhisk actions for you, there should be no need to do anything else if you see an Install Complete message with green OK signs in the CLI.

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


#### Deploy to Bluemix

You can push the app hosted locally by first editing the ```manifest.yml``` file and then use cloud foundry cli to push it to Bluemix.

Edit the `manifest.yml` file in the folder that contains your code and replace with a unique name for your application. The name that you specify determines the application's URL, such as `your-application-name.mybluemix.net`. Additionally - update the service names so they match what you have in Bluemix. The relevant portion of the `manifest.yml` file looks like the following:

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

In the command use the following command to push the application to bluemix:
```
cf push
```

----Deploy to Bluemix button----

[![Deploy to Bluemix](https://bluemix.net/deploy/button.png)](https://bluemix.net/deploy?repository=https://github.com/IBM/  )

#### Application

The app has the following functions:
Home Page: Displays a quick dashboard showing the number of images in the Cloudant database and how many of them have Watson VR analysis completed. It will also provide a count of how many images were deemed as "Needing attention" based on the response the Watson service provided when classifying the images.

You have the ability to see all the images in one single page.

Click on each image to pull up a detailed page providing information on one single event (image). You will be able to see information around the Drone's status when the image was taken, location information, and what the Watson Visual Recognition service saw in the image and the confidence levels.

If you go to the URL.mybluemix.net/simulator page you will be able to access a simulator to help you send images to the Cloudant database in case you do not have a way of using a drone to send data to the cloud. This simulator page can be your "drone". (data that is sent from the simulator is hardcoded within the program and can be changed by the developer after replicating it)

# Extending the journey with Drone!


## Privacy Notice


# License

[Apache 2.0](LICENSE)
