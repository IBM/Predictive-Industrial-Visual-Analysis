#!/bin/bash
#
# Copyright 2016 IBM Corp. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the “License”);
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#  https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an “AS IS” BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Color vars to be used in shell script output
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# load configuration variables
source .env

# capture the namespace where actions will be created
# as we need to pass it to our change listener
CURRENT_NAMESPACE=`ibmcloud fn property get --namespace | awk '{print $3}'`
echo "Current namespace is $CURRENT_NAMESPACE."

function usage() {
  echo -e "${YELLOW}Usage: $0 [--install,--uninstall,--reinstall,--env]${NC}"
}

function install() {
  echo -e "${YELLOW}Installing..."

  echo "Creating image_db package"
  ibmcloud fn package create image_db

  echo "Adding VCAP_SERVICES as parameter"
  ibmcloud fn package update image_db\
    --param cloudantUrl https://$CLOUDANT_USERNAME:$CLOUDANT_PASSWORD@$CLOUDANT_HOST\
    --param cloudantDbName $CLOUDANT_DB\
    --param watsonKey $VR_KEY\
    --param watsonClassifiers $VR_CLASSIFIERS\
    --param functionsHost $FUNCTIONS_APIHOST\
    --param functionsAuth $FUNCTIONS_AUTHORIZATION

  # we will need to listen to cloudant event
  echo "Binding cloudant"
  ibmcloud fn package bind /whisk.system/cloudant \
    image_db-cloudant\
    --param username $CLOUDANT_USERNAME\
    --param password $CLOUDANT_PASSWORD\
    --param host $CLOUDANT_HOST

  echo "Creating trigger"
  ibmcloud fn trigger create image_db-cloudant-update-trigger --feed image_db-cloudant/changes --param dbname $CLOUDANT_DB

  echo "Creating actions"
  ibmcloud fn action create image_db/analysis analysis.js

  # No Longer Needed
  #ibmcloud fn action create image_db/dataCleaner dataCleaner.js

  echo "Creating change listener action"
  #ibmcloud fn action create image_db-cloudant-changelistener changelistener.js --param targetNamespace $CURRENT_NAMESPACE

  #recently added to address removal of includeDoc support
  echo "Creating action sequence"
#ibmcloud fn action create sequenceAction --sequence image_db-cloudant/read,image_db-cloudant
  ibmcloud fn action create sequenceAction --sequence image_db/analysis

  echo "Enabling change listener"
#ibmcloud fn rule create image_db-rule image_db-cloudant-update-trigger image_db-cloudant-changelistener
  ibmcloud fn rule create image_db-rule image_db-cloudant-update-trigger image_db/analysis

  echo "Set Cloudant Param on Trigger"
  ibmcloud fn trigger update image_db-cloudant-update-trigger --param dbname $CLOUDANT_DB

  echo -e "${GREEN}Install Complete${NC}"
  ibmcloud fn list
}

function uninstall() {
  echo -e "${RED}Uninstalling..."

  echo "Removing actions..."
  ibmcloud fn action delete image_db/analysis
  #ibmcloud fn action delete image_db/dataCleaner

  echo "Removing rule..."
  ibmcloud fn rule disable image_db-rule
  ibmcloud fn rule delete image_db-rule

  #echo "Removing change listener..."
  #ibmcloud fn action delete image_db-cloudant-changelistener

  echo "Removing trigger..."
  ibmcloud fn trigger delete image_db-cloudant-update-trigger

  echo "Removing packages..."
  ibmcloud fn package delete image_db-cloudant
  ibmcloud fn package delete image_db

  echo -e "${GREEN}Uninstall Complete${NC}"
  ibmcloud fn list
}

function showenv() {
  echo -e "${YELLOW}"
  echo CLOUDANT_USERNAME=$CLOUDANT_USERNAME
  echo CLOUDANT_PASSWORD=$CLOUDANT_PASSWORD
  echo CLOUDANT_HOST=$CLOUDANT_HOST
  echo CLOUDANT_DB=$CLOUDANT_DB
  echo VR_KEY=$VR_KEY
  echo -e "${NC}"
}

case "$1" in
"--install" )
install
;;
"--uninstall" )
uninstall
;;
"--reinstall" )
uninstall
install
;;
"--env" )
showenv
;;
* )
usage
;;
esac
