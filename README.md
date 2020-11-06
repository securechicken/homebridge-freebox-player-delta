# homebridge-freebox-player-delta
Homebridge plugin to control Freebox Player Delta (Devialet). via HomeKit/iOS devices.

It enables elementary controls (on/off, various apps launch, iOS remote control with volume).

## Plugin Installation
Via NPM (or within Homebridge Plugins tab): `npm install -g homebridge-freebox-player-delta`

## Settings

The plugin configuration is done via Homebridge UI plugins settings.
The result is saved in config as follows:
```
{
	"name": "<your device friendly name>",
	"code": "<your Freebox network remote code>",
	"hostname": "<hostname or IPv4/6 address of your Player device",
	"platform": "FreeboxPlayerDelta"
}
```

The Freebox network remote **code** can be found in your Freebox Player UI, browsing to _System (Système) > Freebox Player and Server Informations (Informations Freebox Player et Server) >  Player > Remote (Télécommande) > Remote network code (Code télécommande réseau)_".

The **hostname** used to be set to "hd1.freebox.fr" by default for older Freebox Revolution Players.
On Delta/Devialet, it is not the case anymore: put the IPv4 address of your player (you can find it from your devices list in Freebox Server UI), or the Player hostname in _System (Système) > Network (Réseau) > Player network name (Nom réseau du Player)_.

## Association

- Run HomeKit app on your iOS device, select "+", "Add an accessory", then "I don't have a code..." top down
- Type-in your Homebridge code (shown below QR Code in Homebridge UI)
