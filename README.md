# homebridge-freebox-player-delta
Homebridge plugin to control Freebox Player Delta.

It enables elementary controls (on/off, Netflix launch, volume and channels change).

## Installation
Via NPM (or within Homebridge Plugins tab): `npm install -g homebridge-freebox-player-delta`

## Configuration

The plugin configuration item from Homebridge config (available from Plugin "Settings" button) appears as follow:
```
{
    "platform": "HomebridgeFreeboxPlayer",
    "name": "<your device fancy name>",
    "code": "<your Freebox network remote code>",
    "hostname": "<hostname or IPv4/6 address of your Player device",
    "appsShortcutEnabled": <true or false, enables some apps launch shortcuts>
}
```

The Freebox network remote **code** can be found in your Freebox player UI, browsing to _System (Système) > Freebox Player and Server Informations (Informations Freebox Player et Server) >  Player > Remote (Télécommande) > Remote network code (Code télécommande réseau)_".

The **hostname** used to be set to "hd1.freebox.fr" for Freebox revolution players. On Delta, put the IPv4 address of your player (you can find it from your devices list in Freebox server UI), or the Player hostname in _System (Système) > Network (Réseau) > Player network name (Nom réseau du Player)_.
