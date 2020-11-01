const PLUGIN_NAME = "homebridge-freebox-player-delta";
const PLATFORM_NAME = "FreeboxPlayerDelta";
const request = require("request");

// Freebox Player keys reference:
// https://dev.freebox.fr/sdk/freebox_player_codes.html
const PLAYER_POWER = "power";
const PLAYER_CHANNEL_UP = "prgm_inc";
const PLAYER_CHANNEL_DOWN = "prgm_dec";
const PLAYER_VOLUME_UP = "vol_inc";
const PLAYER_VOLUME_DOWN = "vol_dec";
const PLAYER_INFO = "info";
const PLAYER_REWIND = "bwd";
const PLAYER_FORWARD = "fwd";
const PLAYER_UP = "up";
const PLAYER_DOWN = "down";
const PLAYER_LEFT = "left";
const PLAYER_RIGHT = "right";
const PLAYER_OK = "ok";
const PLAYER_BACK = "back";
const PLAYER_APP_HOME = "home";
const PLAYER_APP_TV = "tv";
const PLAYER_APP_NETFLIX = "netflix";
const PLAYER_APP_YOUTUBE = "youtube";
const PLAYER_APP_MEDIA = "media";

const SERVICE_IDENTIFIER_HOME = 1;
const SERVICE_IDENTIFIER_TV = 2;
const SERVICE_IDENTIFIER_NETFLIX = 3;
const SERVICE_IDENTIFIER_YOUTUBE = 4;
const SERVICE_IDENTIFIER_MEDIA = 5;

const IDENTIFIER_KEY_MAP = {
	SERVICE_IDENTIFIER_HOME: PLAYER_APP_HOME,
	SERVICE_IDENTIFIER_TV: PLAYER_APP_TV,
	SERVICE_IDENTIFIER_NETFLIX: PLAYER_APP_NETFLIX,
	SERVICE_IDENTIFIER_YOUTUBE: PLAYER_APP_YOUTUBE,
	SERVICE_IDENTIFIER_MEDIA: PLAYER_APP_MEDIA
};

module.exports = (api) => {
	api.registerPlatform(PLATFORM_NAME, FreeboxPlayerDelta);
}

class FreeboxPlayerDelta {
	constructor(log, config, api) {
		this.log = log;
		// Expected keys: name, code, hostname
		this.config = config;
		this.api = api;

		// Register device and associated service
		this.Service = api.hap.Service;
		this.Characteristic = api.hap.Characteristic;
		const tvName = this.config.name || "FreeboxPlayerDelta"
		const uuid = this.api.hap.uuid.generate("homebridge:freebox-player-delta" + tvName);
		this.tvAccessory = new api.platformAccessory(tvName, uuid);
		this.tvAccessory.category = this.api.hap.Categories.TELEVISION;
		const tvService = this.tvAccessory.addService(this.Service.Television);
		tvService.setCharacteristic(this.Characteristic.ConfiguredName, tvName);
		tvService.setCharacteristic(this.Characteristic.SleepDiscoveryMode, this.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);

		// Handle ON/OFF state and Player power switch
		tvService.setCharacteristic(this.Characteristic.Active, this.getPowerState());
		tvService.getCharacteristic(this.Characteristic.Active)
			.on("get", (callback) => {
				callback(null, this.getPowerState());
			})
			.on("set", (newValue, callback) => {
				this.requestRemoteKey(PLAYER_POWER);
				tvService.updateCharacteristic(this.Characteristic.Active, this.getPowerState());
				callback(null);
			});

		// Initial service set to "HOME"
		tvService.setCharacteristic(this.Characteristic.ActiveIdentifier, SERVICE_IDENTIFIER_HOME);

		// Handle remote control input
		tvService.getCharacteristic(this.Characteristic.RemoteKey)
			.on("set", (newValue, callback) => {
				switch (newValue) {
					case this.Characteristic.RemoteKey.REWIND: {
						this.requestRemoteKey(PLAYER_REWIND);
						break;
					}
					case this.Characteristic.RemoteKey.FAST_FORWARD: {
						this.requestRemoteKey(PLAYER_FORWARD);
						break;
					}
					case this.Characteristic.RemoteKey.NEXT_TRACK: {
						this.requestRemoteKey(PLAYER_CHANNEL_UP);
						break;
					}
					case this.Characteristic.RemoteKey.PREVIOUS_TRACK: {
						this.requestRemoteKey(PLAYER_CHANNEL_DOWN);
						break;
					}
					case this.Characteristic.RemoteKey.ARROW_UP: {
						this.requestRemoteKey(PLAYER_UP);
						break;
					}
					case this.Characteristic.RemoteKey.ARROW_DOWN: {
						this.requestRemoteKey(PLAYER_DOWN);
						break;
					}
					case this.Characteristic.RemoteKey.ARROW_LEFT: {
						this.requestRemoteKey(PLAYER_LEFT);
						break;
					}
					case this.Characteristic.RemoteKey.ARROW_RIGHT: {
						this.requestRemoteKey(PLAYER_RIGHT);
						break;
					}
					case this.Characteristic.RemoteKey.SELECT: {
						this.requestRemoteKey(PLAYER_OK);
						break;
					}
					case this.Characteristic.RemoteKey.BACK: {
						this.requestRemoteKey(PLAYER_BACK);
						break;
					}
					case this.Characteristic.RemoteKey.EXIT: {
						this.requestRemoteKey(PLAYER_HOME);
						break;
					}
					case this.Characteristic.RemoteKey.PLAY_PAUSE: {
						this.requestRemoteKey(PLAYER_PLAY);
						break;
					}
					case this.Characteristic.RemoteKey.INFORMATION: {
						this.requestRemoteKey(PLAYER_INFO);
						break;
					}
				}
				callback(null);
			});

		// Create an associated speaker service for Player
		const speakerService = this.tvAccessory.addService(this.Service.TelevisionSpeaker);
		speakerService.setCharacteristic(this.Characteristic.Active, this.getPowerState());
		speakerService.getCharacteristic(this.Characteristic.Active)
			.on("get", (callback) => {
				callback(null, this.getPowerState());
			});
		speakerService.setCharacteristic(this.Characteristic.VolumeControlType, this.Characteristic.VolumeControlType.ABSOLUTE);
		// Handle speaker service volume control
		speakerService.getCharacteristic(this.Characteristic.VolumeSelector)
			.on("set", (newValue, callback) => {
				if (newValue == 0) {
					this.requestRemoteKey(PLAYER_VOLUME_UP);
				} else {
					this.requestRemoteKey(PLAYER_VOLUME_DOWN);
				}
				callback(null);
			});

		// Handle input source changes, leveraged as app launchers
		tvService.getCharacteristic(this.Characteristic.ActiveIdentifier)
			.on("set", (newValue, callback) => {
				this.requestSource(newValue);
				callback(null);
			});
		// Home
		const homeInputService = this.tvAccessory.addService(this.Service.InputSource, "home", "Home");
		homeInputService.setCharacteristic(this.Characteristic.Identifier, SERVICE_IDENTIFIER_HOME);
		homeInputService.setCharacteristic(this.Characteristic.ConfiguredName, "Home");
		homeInputService.setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED);
		homeInputService.setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.HDMI);
		tvService.addLinkedService(homeInputService);
		// TV
		const tvInputService = this.tvAccessory.addService(this.Service.InputSource, "tv", "TV");
		netflixInputService.setCharacteristic(this.Characteristic.Identifier, SERVICE_IDENTIFIER_TV);
		netflixInputService.setCharacteristic(this.Characteristic.ConfiguredName, "TV");
		netflixInputService.setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED);
		netflixInputService.setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.HDMI);
		tvService.addLinkedService(tvInputService);
		// Netflix
		const netflixInputService = this.tvAccessory.addService(this.Service.InputSource, "netflix", "Netflix");
		netflixInputService.setCharacteristic(this.Characteristic.Identifier, SERVICE_IDENTIFIER_NETFLIX);
		netflixInputService.setCharacteristic(this.Characteristic.ConfiguredName, "Netflix");
		netflixInputService.setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED);
		netflixInputService.setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.HDMI);
		tvService.addLinkedService(netflixInputService);
		// YouTube
		const youtubeInputService = this.tvAccessory.addService(this.Service.InputSource, "youtube", "Youtube");
		netflixInputService.setCharacteristic(this.Characteristic.Identifier, SERVICE_IDENTIFIER_YOUTUBE);
		netflixInputService.setCharacteristic(this.Characteristic.ConfiguredName, "Youtube");
		netflixInputService.setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED);
		netflixInputService.setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.HDMI);
		tvService.addLinkedService(youtubeInputService);
		// Media
		const mediaInputService = this.tvAccessory.addService(this.Service.InputSource, "media", "Media");
		netflixInputService.setCharacteristic(this.Characteristic.Identifier, SERVICE_IDENTIFIER_MEDIA);
		netflixInputService.setCharacteristic(this.Characteristic.ConfiguredName, "Media");
		netflixInputService.setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED);
		netflixInputService.setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.HDMI);
		tvService.addLinkedService(mediaInputService);

		this.api.publishExternalAccessories(PLUGIN_NAME, [this.tvAccessory]);
	}

	// Determine power status
	getPowerState() {
		let powerState = this.Characteristic.Active.INACTIVE;
		let testUrl = "http://" + this.config.hostname + ":7000/";
		request(testUrl, {timeout: 1000}, function (error, response, body) {
			if (error) {
				powerState = this.Characteristic.Active.INACTIVE;
			} else if (response && response.statusCode == 404) {
				powerState = this.Characteristic.Active.ACTIVE;
			}
		});
		return powerState;
	}

	// Send remote key to Player
	requestRemoteKey(key, callback) {
		let url = "http://" + this.config.hostname + "/pub/remote_control?key=" + key + "&code=" + this.config.code;
		this.log.info("Send Player Delta command: " + url);
		request(url, function (error, response, body) {
			if (callback != null) {
				callback();
			}
		});
	}

	// Switch input source = send app keys to remote.
	requestSource(source) {
		this.requestRemoteKey(IDENTIFIER_KEY_MAP[source]);
	}
}
