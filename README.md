# Sense Tecnic IoT Platform Nodes for Node-RED

This package provides a set of input and output [Node-RED](http://nodered.org) nodes for the [Sense Tecnic](http://www.sensetecnic.com) IoT platform including the free [WoTKit](http://wotkit.sensetecnic.com) community service. These nodes allow you to send and receive data and real-time control messages from sensors and actuators.

To make use of these nodes you will need a WoTKit account.  You can register for free at [http://wotkit.sensetecnic.com](http://wotkit.sensetecnic.com).

## Dependencies

These nodes can be used with [Node-RED](http://nodered.org/docs/index.html). You can [install node red globally](http://nodered.org/docs/getting-started/installation.html) by doing:

```
sudo npm install -g node-red
```

## Installation

These nodes can be installed using npm.

To install globally, alongside node-red, you can either use the latest code from GitHub:

```
sudo npm install -g SenseTecnic/wotkit-node
```

or use the stable release published as an npm module:

```
cd node-red
npm install -g node-red-contrib-wotkit
```

## About WoTKit

[WoTKit](http://wotkit.sensetecnic.com) is a community version of the STS IoT Platform, it allows you to manage, visualize and analyze data from sensors with ease. In WoTKit you can create public and private sensors, access a large selection of public sensors, create powerful dashboards, and develop robust IoT applications. Moreover, you can leverage its powerful API to build any application you can imagine. WoTKit data can also be used with FRED (http://fred.sensetecnic.com), your own cloud-hosted Node-RED instance to do things like quickly prototype IoT applications by connecting web services and sensors.

WoTKit and FRED are FREE, and you can create an a WoTKit account at [http://wotkit.sensetecnic.com](http://wotkit.sensetecnic.com) and a FRED account at [http://fred.sensetecnic.com](http://fred.sensetecnic.com)

## Using the WoTKit nodes.

The node-red-contrib-wotkit package has the following nodes:

#### WoTKit credentials

To use all WoTKit nodes you must configure add a wotkit-credentials node. You can create a key at [https://wotkit.sensetecnic.com/wotkit/keys](https://wotkit.sensetecnic.com/wotkit/keys). You can then use that key's "Key Id" and "Key Password".

By default WoTKit URL uses the STS Platform free version "WoTKit".

#### WoTKit In

This node retrieves data sent to a WoTKit sensor after this node is deployed. To use this node you need to create a WoTKit account. You also need to create a sensor in WoTKit. The message.payload contains a map of sensor field names to sensor values:

```
{
 "timestamp": 1438213331183,
 "timestamp_iso": "2015-07-29T23:42:11.183Z",
 "value": 268633849
}
```
The sensor name should be in the form {username}.{sensorname} or you can use the numeric sensor id.

The poll interval specifies how often this node calls the WoTKit to retrieve new sensor data.

Note: the first request will occur after the initial poll interval has elapsed, starting with data sent to the sensor after the node was deployed.

#### WoTKit Out

Sends data to a registered WoTKit sensor. The node will use the message.payload to create a data object.

The message.payload must contain an Object of key-value pairs matching the sensor fields. For example a sensor with the default fields expects:

```
msg.payload = {
	value:1028,
	lat:123.60,
	lng:49.23,
	message:"Memory Update"
}
```

If receiving a number from another node, for example

```
message.payload = 123456
```

the sensor's value field will be updated using the following object:

```
msg.payload = { value:  123456}
```

If receiving a string from another node, for example

```
message.payload = "Hello World"
```

the sensor's message field will be updated using the following object:

```
msg.payload = { message:  "Hello World"}
```

The WotKit Sensor Name should be in the form of {username}.{sensorname} or using the numeric sensor id.

#### WoTKit Data

Retrieves historical data from a WoTKit sensor by either number of elements or relative time before the request. The message.payload contains a map of sensor values.

```
{
 "timestamp": 1438213331183,
 "timestamp_iso": "2015-07-29T23:42:11.183Z",
 "value": 268633849
}
```

Selecting "Elements" will retrieve the last X number of data elements.

Selecting "Seconds" will retrieve any data elements created in the last X seconds. For example "10 Seconds" will retrieve all elements created after 10 seconds before the node received an input message.

The sensor name should be in the form {username}.{sensorname} or you can use the numeric sensor id.


#### WoTKit Control Out

Provides ability to send events to the control channel of a registered WoTKit sensor. This node will use the message.payload object to create a control event.

The message.payload must contain an Object of key-value pair for each message. For example, to send a control "button: on" message:

```
msg.payload = {
	"button":"on"
}
```

If receiving a number from another node, for example

```
message.payload = 123456
```

the following message will be sent:

```
msg.payload = { "slider":  "123456"}
```

If receiving a string from another node, for example

```
message.payload = "Hello World"
```

the following message will be sent:

```
msg.payload = { "message":  "Hello World"}
```

The WotKit Sensor Name should be in the form of {username}.{sensorname} or using the numeric sensor id.

#### WoTKit Control In

Provides access to the control channel of a registered WoTKit sensor. When a control event is received by a WoTKit sensor this node will create a message.payload object containing the event.

The sensor name should be in the form {username}.{sensorname} or you can use the numeric sensor id.

Note: the first request will occur after the intial poll interval has elapsed, starting with data sent to the sensor after the node was deployed.

## Contributing

Contact us to contribute.

## Copyright and license

Copyright 2015 [Sense Tecnic Systems, Inc.](http://www.sensetecnic.com) [the Apache 2.0 license](https://www.apache.org/licenses/LICENSE-2.0).
