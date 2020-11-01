const PLUGIN_NAME = 'homebridge-freebox-player-delta';
const PLATFORM_NAME = 'HomebridgeFreeboxPlayerDelta';
const request = require('request');

// Freebox Player keys reference:
// https://dev.freebox.fr/sdk/freebox_player_codes.html
PLAYER_POWER = "power";
PLAYER_CHANNEL_UP = "prgm_inc";
PLAYER_CHANNEL_DOWN = "prgm_dec";
PLAYER_VOLUME_UP = "vol_inc";
PLAYER_VOLUME_DOWN = "vol_dec";
PLAYER_INFO = "info";
PLAYER_APP_HOME = "home";
PLAYER_APP_TV = "tv";
PLAYER_APP_NETFLIX = "netflix";
PLAYER_APP_YOUTUBE = "youtube";
PLAYER_APP_MEDIA = "media";

SERVICE_IDENTIFIER_HOME = 1;
SERVICE_IDENTIFIER_TV = 2;
SERVICE_IDENTIFIER_NETFLIX = 3;
SERVICE_IDENTIFIER_YOUTUBE = 4;
SERVICE_IDENTIFIER_MEDIA = 5;

module.exports = (api) => {
	api.registerPlatform(PLATFORM_NAME, HomebridgeFreeboxPlayerDeltaPlugin);
}

class FreeboxPlayerPlugin {
	constructor(log, config, api) {
		this.log = log;
		// Expected keys: name, code, hostname
		this.config = config;
		this.api = api;

		// Register device and associated service
		this.Service = api.hap.Service;
		this.Characteristic = api.hap.Characteristic;
		const tvName = this.config.name || 'FreeboxPlayerDelta'
		const uuid = this.api.hap.uuid.generate('homebridge:freebox-player-delta' + tvName);
		this.tvAccessory = new api.platformAccessory(tvName, uuid);
		this.tvAccessory.category = this.api.hap.Categories.TELEVISION;
		const tvService = this.tvAccessory.addService(this.Service.Television);
		tvService.setCharacteristic(this.Characteristic.ConfiguredName, tvName);
		tvService.setCharacteristic(this.Characteristic.SleepDiscoveryMode, this.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);

		// Handle ON/OFF state and Player power switch
		tvService.getCharacteristic(this.Characteristic.Active)
			.on('set', (newValue, callback) => {
				this.requestRemoteKey(PLAYER_POWER);
				tvService.updateCharacteristic(this.Characteristic.Active, 1);
				callback(null);
			});

		// Initial service set to "HOME"
		tvService.setCharacteristic(this.Characteristic.ActiveIdentifier, SERVICE_IDENTIFIER_HOME);

		// Handle remote control input
		tvService.getCharacteristic(this.Characteristic.RemoteKey)
			.on('set', (newValue, callback) => {
				switch (newValue) {
					case this.Characteristic.RemoteKey.CHANNEL_UP: {
						this.requestRemoteKey(PLAYER_CHANNEL_UP);
						break;
					}
					case this.Characteristic.RemoteKey.CHANNEL_DOWN: {
						this.requestRemoteKey(PLAYER_CHANNEL_DOWN);
						break;
					}
					case this.Characteristic.RemoteKey.INFO: {
						this.requestRemoteKey(PLAYER_INFO);
						break;
					}
				}
				callback(null);
			});

		// Create an associated speaker service for Player
		const speakerService = this.tvAccessory.addService(this.Service.TelevisionSpeaker);
		speakerService.setCharacteristic(this.Characteristic.Active, this.Characteristic.Active.ACTIVE)
		speakerService.setCharacteristic(this.Characteristic.VolumeControlType, this.Characteristic.VolumeControlType.ABSOLUTE);
		// Handle speaker service volume control
		speakerService.getCharacteristic(this.Characteristic.VolumeSelector)
			.on('set', (newValue, callback) => {
				if (newValue == 0) {
					this.requestRemoteKey(PLAYER_VOLUME_UP)
				} else {
					this.requestRemoteKey(PLAYER_VOLUME_DOWN)
				}
				callback(null);
			});

		// Handle input source changes, leveraged as app launchers
		tvService.getCharacteristic(this.Characteristic.ActiveIdentifier)
			.on('set', (newValue, callback) => {
				this.requestSource(newValue);
				callback(null);
			});
		// Home
		const homeInputService = this.tvAccessory.addService(this.Service.InputSource, 'home', 'Home');
		homeInputService.setCharacteristic(this.Characteristic.Identifier, SERVICE_IDENTIFIER_HOME)
		homeInputService.setCharacteristic(this.Characteristic.ConfiguredName, 'Home')
		homeInputService.setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED)
		homeInputService.setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.HDMI);
		tvService.addLinkedService(homeInputService);
		// Netflix Input Source
		const netflixInputService = this.tvAccessory.addService(this.Service.InputSource, 'netflix', 'Netflix');
		netflixInputService.setCharacteristic(this.Characteristic.Identifier, SERVICE_IDENTIFIER_NETFLIX)
		netflixInputService.setCharacteristic(this.Characteristic.ConfiguredName, 'Netflix')
		netflixInputService.setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED)
		netflixInputService.setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.HDMI);
		tvService.addLinkedService(netflixInputService); // link to tv service

		this.api.publishExternalAccessories(PLUGIN_NAME, [this.tvAccessory]);
	}

	requestRemoteKey(key, callback) {
		let url = 'http://' + this.config.hostname + '/pub/remote_control?key=' + key + '&code=' + this.config.code;
		this.log.info("Send Player Delta command: " + url)
		request(url, function (error, response, body) {
			if (callback != null) {
				callback();
			}
		});
	}

	requestSource(source) {
		switch(source) {
			case SERVICE_IDENTIFIER_HOME: {
				this.requestRemoteKey(PLAYER_APP_HOME);
			}
			case SERVICE_IDENTIFIER_NETFLIX: {
				this.requestRemoteKey(PLAYER_APP_NETFLIX);
			}
		}
	}
}
