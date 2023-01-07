# homebridge-freebox-player-delta
Homebridge plugin to control Freebox Player Delta (Devialet) via HomeKit/iOS devices.

| :exclamation:  Unfortunately I'm not using Homebridge anymore, and as a consequence does not maintain the plugin - which can still be forked and updated elsewhere if need be. |
|-----------------------------------------|

It enables elementary controls: on/off, Netflix/Youtube apps launch, iOS remote control with volume.

## Disclaimer
This plugin is provided to be used as it is within Homebrige by advanced and tech-savvy users, or to serve as a code base for developers. The initial developer does not intend to implement additional features, or to offer general support on Homebridge, Apple iOS and Free Player use. Issues which prevent elementary and intended functions to work properly will be reviewed and considered. Enhancements requests will only be accepted from proposed pull requests. Users are free to fork and adapt this code base according to their needs, and in compliance with the license.

## Plugin Installation
Use Homebridge Plugins tab, or NPM: `npm install -g homebridge-freebox-player-delta`

## Settings

The plugin configuration is done via Homebridge UI plugins settings.
The result is saved in config as follows:
```
{
	"name": "<your device friendly name>",
	"code": "<your Freebox network remote code>",
	"hostname": "<hostname or IPv4/6 address of your Player device",
	"powerstatus": "<the network service (TCP port) to check for in order to determine if the Player is ON or OFF: 7000 or 54243>",
	"platform": "FreeboxPlayerDelta"
}
```

The Freebox network remote **code** can be found in your Freebox Player UI, browsing to _Settings (Réglages) > System (Système) > Freebox Player and Server Informations (Informations Freebox Player et Server) >  Player > Remote (Télécommande) > Remote network code (Code télécommande réseau)_.

The **hostname** used to be set to "hd1.freebox.fr" by default for older Freebox Revolution Players.
On Delta/Devialet, it is not the case anymore: put the IPv4 address of your player (you can find it from your devices list in Freebox Server UI), or the Player hostname in _System (Système) > Network (Réseau) > Player network name (Nom réseau du Player)_.

The **powerstatus** service is set to AirPlay (TCP 7000) by default. This means the plugin will regularly attempt to connect to the AirPlay service of the Player in order to check if it is ON or OFF. In order for the power status to be correctly reported, the AirPlay service must be activated on the Freebox Player. It should be the case by default. If it is not enabled, you can turn it on with the Freebox Player UI, at _Settings (Réglages) > Applications > AirMedia Video > Enable AirMedia for Apple devices (Activer AirMedia pour les appareils Apple)_. In case you do not want to enable this service, the only alternative is enabling the UPnP service (TCP port 54243), that must be turned in the Player at _Settings (Réglages) > Applications > AirMedia Video > Enable UPnP rendering server (Activer le serveur de rendu UPnP)_, and setting the plugin powerstatus configuration to UPnP. If both services are disabled on the Freebox Player, the status will always be reported as OFF.

## Association

- Run HomeKit app on your iOS device, select "+", "Add an accessory", then "I don't have a code..." top down
- Type-in your Homebridge code (shown below QR Code in Homebridge UI)
