const PLUGIN_NAME = "homebridge-freebox-player-delta";
const PLATFORM_NAME = "FreeboxPlayerDelta";
const request = require("request");
const tcpp = require("tcp-ping");

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

module.exports = (api) => {
	api.registerPlatform(PLATFORM_NAME, FreeboxPlayerDelta);
}

class FreeboxPlayerDelta {
	constructor(log, config, api) {
		this.log = log;
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
		tvService.getCharacteristic(this.Characteristic.Active)
			.on("get", this.checkPowerState.bind(this))
			.on("set", (newValue, callback) => {
				this.requestRemoteKey(PLAYER_POWER);
				tvService.updateCharacteristic(this.Characteristic.Active, newValue);
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
		homeInputService.setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.HOME_SCREEN);
		tvService.addLinkedService(homeInputService);
		// TV
		const tvInputService = this.tvAccessory.addService(this.Service.InputSource, "tv", "TV");
		tvInputService.setCharacteristic(this.Characteristic.Identifier, SERVICE_IDENTIFIER_TV);
		tvInputService.setCharacteristic(this.Characteristic.ConfiguredName, "TV");
		tvInputService.setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED);
		tvInputService.setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.TUNER);
		tvService.addLinkedService(tvInputService);
		// Netflix
		const netflixInputService = this.tvAccessory.addService(this.Service.InputSource, "netflix", "Netflix");
		netflixInputService.setCharacteristic(this.Characteristic.Identifier, SERVICE_IDENTIFIER_NETFLIX);
		netflixInputService.setCharacteristic(this.Characteristic.ConfiguredName, "Netflix");
		netflixInputService.setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED);
		netflixInputService.setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.APPLICATION);
		tvService.addLinkedService(netflixInputService);
		// YouTube
		const youtubeInputService = this.tvAccessory.addService(this.Service.InputSource, "youtube", "Youtube");
		youtubeInputService.setCharacteristic(this.Characteristic.Identifier, SERVICE_IDENTIFIER_YOUTUBE);
		youtubeInputService.setCharacteristic(this.Characteristic.ConfiguredName, "Youtube");
		youtubeInputService.setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED);
		youtubeInputService.setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.APPLICATION);
		tvService.addLinkedService(youtubeInputService);
		// Media
		const mediaInputService = this.tvAccessory.addService(this.Service.InputSource, "media", "Media");
		mediaInputService.setCharacteristic(this.Characteristic.Identifier, SERVICE_IDENTIFIER_MEDIA);
		mediaInputService.setCharacteristic(this.Characteristic.ConfiguredName, "Media");
		mediaInputService.setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED);
		mediaInputService.setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.APPLICATION);
		tvService.addLinkedService(mediaInputService);

		// Create an associated speaker service for Player
		const speakerService = this.tvAccessory.addService(this.Service.TelevisionSpeaker);
		speakerService.getCharacteristic(this.Characteristic.Active)
			.on("get", this.checkPowerState.bind(this))
			.on("set", (newValue, callback) => {
				speakerService.updateCharacteristic(this.Characteristic.Active, newValue);
				callback(null);
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

		this.api.publishExternalAccessories(PLUGIN_NAME, [this.tvAccessory]);
	}

	// Determine power status
	checkPowerState(callback) {
		tcpp.ping({address: this.config.hostname, port: 7000, timeout: 1000, attempts:1}, function(err, data) {
			let res = (data.min !== undefined) ? (1) : (0);
			callback(err, res);
		});
	}

	// Send remote key to Player
	requestRemoteKey(key) {
		let url = "http://" + this.config.hostname + "/pub/remote_control?key=" + key + "&code=" + this.config.code;
		request.get(url);
	}

	// Switch input source = send app keys to remote.
	requestSource(source) {
		switch (source) {
			case SERVICE_IDENTIFIER_HOME: {
				this.requestRemoteKey(PLAYER_APP_HOME);
				break;
			}
			case SERVICE_IDENTIFIER_TV: {
				this.requestRemoteKey(PLAYER_APP_TV);
				break;
			}
			case SERVICE_IDENTIFIER_NETFLIX: {
				this.requestRemoteKey(PLAYER_APP_NETFLIX);
				break;
			}
			case SERVICE_IDENTIFIER_YOUTUBE: {
				this.requestRemoteKey(PLAYER_APP_YOUTUBE);
				break;
			}
			case SERVICE_IDENTIFIER_MEDIA: {
				this.requestRemoteKey(PLAYER_APP_MEDIA);
				break;
			}
		}
	}
}
