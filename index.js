const PLUGIN_NAME = "homebridge-freebox-player-delta";
const PLUGIN_AUTHOR = "@securechicken";
const PLUGIN_VERSION = "1.0.0";
const PLUGIN_DEVICE_MANUFACTURER = "Free";
const PLUGIN_DEVICE_MODEL = "Freebox Player Devialet";
const PLATFORM_NAME = "FreeboxPlayerDelta";
const request = require("request");
const tcpp = require("tcp-ping");

module.exports = (api) => {
	api.registerPlatform(PLATFORM_NAME, FreeboxPlayerDelta);
};

const TCP_ALIVE_CHECK_PORT = 7000;
const TCP_ALIVE_TIMEOUT = 500;
const TCP_ALIVE_ATTEMPTS = 1;
// Freebox Player keys reference:
// https://dev.freebox.fr/sdk/freebox_player_codes.html
// http://tutoriels.domotique-store.fr/content/51/90/fr/api-de-la-freebox-tv-_-player-v5-_-v6-via-requêtes-http.html
const PLAYER_POWER = "power";
const PLAYER_CHANNEL_UP = "prgm_inc";
const PLAYER_CHANNEL_DOWN = "prgm_dec";
const PLAYER_VOLUME_UP = "vol_inc";
const PLAYER_VOLUME_DOWN = "vol_dec";
//const PLAYER_MUTE = "mute";
const PLAYER_INFO = "info";
const PLAYER_PLAY = "play";
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
const SOURCE_IDENTIFIER_HOME = 1;
const SOURCE_IDENTIFIER_TV = 2;
const SOURCE_IDENTIFIER_NETFLIX = 3;
const SOURCE_IDENTIFIER_YOUTUBE = 4;
const SOURCE_IDENTIFIER_MEDIA = 5;

class FreeboxPlayerDelta {
	constructor(log, config, api) {
		this.log = log;
		this.config = config;
		this.api = api;
		this.Service = api.hap.Service;
		this.Characteristic = api.hap.Characteristic;

		// Register platform
		const tvName = this.config.name || "Freebox";
		const uuid = this.api.hap.uuid.generate("homebridge:freebox-player-delta-" + this.config.hostname + "-" + tvName);
		this.tvPlatform = new api.platformAccessory(tvName, uuid);
		this.tvPlatform.category = this.api.hap.Categories.TELEVISION;

		// Create associated services: TV, TV input sources, Speaker, Info
		this.tvService = this.tvPlatform.addService(this.Service.Television);
		this.tvService
			.setCharacteristic(this.Characteristic.ConfiguredName, tvName)
			.setCharacteristic(this.Characteristic.SleepDiscoveryMode, this.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
		// Home source
		this.addInputSource(SOURCE_IDENTIFIER_HOME, PLAYER_APP_HOME, "Home", this.Characteristic.InputSourceType.HOME_SCREEN,
			(err, source) => { this.tvHomeInputService = source; this.tvService.addLinkedService(this.tvHomeInputService); });
		// TV source
		this.addInputSource(SOURCE_IDENTIFIER_TV, PLAYER_APP_TV, "TV", this.Characteristic.InputSourceType.TUNER,
			(err, source) => { this.tvTvInputService = source; this.tvService.addLinkedService(this.tvTvInputService); });
		// Netflix source
		this.addInputSource(SOURCE_IDENTIFIER_NETFLIX, PLAYER_APP_NETFLIX, "Netflix", this.Characteristic.InputSourceType.APPLICATION,
			(err, source) => { this.tvNetflixInputService = source; this.tvService.addLinkedService(this.tvNetflixInputService); });
		// YouTube source
		this.addInputSource(SOURCE_IDENTIFIER_YOUTUBE, PLAYER_APP_YOUTUBE, "Youtube", this.Characteristic.InputSourceType.APPLICATION,
			(err, source) => { this.tvYoutubeInputService = source; this.tvService.addLinkedService(this.tvYoutubeInputService); });
		// Media source
		this.addInputSource(SOURCE_IDENTIFIER_MEDIA, PLAYER_APP_MEDIA, "Media", this.Characteristic.InputSourceType.APPLICATION,
			(err, source) => { this.tvMediaInputService = source; this.tvService.addLinkedService(this.tvMediaInputService); });
		// Speaker
		this.speakerService = this.tvPlatform.addService(this.Service.TelevisionSpeaker);
		this.tvService.addLinkedService(this.speakerService);
		// Device infos
		this.infoService = this.tvPlatform.getService(this.Service.AccessoryInformation);
		this.infoService
			.setCharacteristic(this.Characteristic.Manufacturer, PLUGIN_DEVICE_MANUFACTURER)
			.setCharacteristic(this.Characteristic.Model, PLUGIN_DEVICE_MODEL)
			.setCharacteristic(this.Characteristic.Name, tvName)
			.setCharacteristic(this.Characteristic.SerialNumber, uuid)
			.setCharacteristic(this.Characteristic.SoftwareRevision, PLUGIN_VERSION)
			.setCharacteristic(this.Characteristic.FirmwareRevision, PLUGIN_NAME)
			.setCharacteristic(this.Characteristic.HardwareRevision, PLUGIN_AUTHOR);

		// Forced initial arbitrary states
		this.tvService.setCharacteristic(this.Characteristic.Active, this.Characteristic.Active.INACTIVE);
		this.tvService.setCharacteristic(this.Characteristic.ActiveIdentifier, SOURCE_IDENTIFIER_HOME);
		this.speakerService.setCharacteristic(this.Characteristic.Active, this.Characteristic.Active.ACTIVE);
		this.speakerService.setCharacteristic(this.Characteristic.Mute, this.Characteristic.Active.ACTIVE);
		this.speakerService.setCharacteristic(this.Characteristic.VolumeControlType, this.Characteristic.VolumeControlType.RELATIVE);

		// Services methods and events handling
		// Handle TV Service ON/OFF state and power switch
		this.tvPowerState = this.tvService.getCharacteristic(this.Characteristic.Active).value;
		this.tvService.getCharacteristic(this.Characteristic.Active)
			.on("get", this.getTvPowerState.bind(this))
			.on("set", this.setTvPowerState.bind(this));
		// Handle remote control input
		this.remoteKeyMapping = new Map();
		this.remoteKeyMapping
			.set(this.Characteristic.RemoteKey.REWIND, PLAYER_REWIND)
			.set(this.Characteristic.RemoteKey.FAST_FORWARD, PLAYER_FORWARD)
			.set(this.Characteristic.RemoteKey.NEXT_TRACK, PLAYER_CHANNEL_UP)
			.set(this.Characteristic.RemoteKey.PREVIOUS_TRACK, PLAYER_CHANNEL_DOWN)
			.set(this.Characteristic.RemoteKey.ARROW_UP, PLAYER_UP)
			.set(this.Characteristic.RemoteKey.ARROW_DOWN, PLAYER_DOWN)
			.set(this.Characteristic.RemoteKey.ARROW_LEFT, PLAYER_LEFT)
			.set(this.Characteristic.RemoteKey.ARROW_RIGHT, PLAYER_RIGHT)
			.set(this.Characteristic.RemoteKey.SELECT, PLAYER_OK)
			.set(this.Characteristic.RemoteKey.BACK, PLAYER_BACK)
			.set(this.Characteristic.RemoteKey.EXIT, PLAYER_APP_HOME)
			.set(this.Characteristic.RemoteKey.PLAY_PAUSE, PLAYER_PLAY)
			.set(this.Characteristic.RemoteKey.INFORMATION, PLAYER_INFO);
		this.tvService.getCharacteristic(this.Characteristic.RemoteKey)
			.on("set", this.setTvRemoteKey.bind(this));
		// Handle input source (leveraged as app launchers) change
		this.inputSourceMapping = new Map();
		this.inputSourceMapping
			.set(SOURCE_IDENTIFIER_HOME, PLAYER_APP_HOME)
			.set(SOURCE_IDENTIFIER_TV, PLAYER_APP_TV)
			.set(SOURCE_IDENTIFIER_NETFLIX, PLAYER_APP_NETFLIX)
			.set(SOURCE_IDENTIFIER_YOUTUBE, PLAYER_APP_YOUTUBE)
			.set(SOURCE_IDENTIFIER_MEDIA, PLAYER_APP_MEDIA);
		this.tvService.getCharacteristic(this.Characteristic.ActiveIdentifier)
			.on("set", this.setTvInputSource.bind(this));
		// Speaker mute state (elementary, from TV ON/OFF state: real mute from remotes is not handled)
		this.speakerService.getCharacteristic(this.Characteristic.Mute)
			.on("get", this.getTvMuteState.bind(this));
		// Handle speaker service volume control
		this.speakerService.getCharacteristic(this.Characteristic.VolumeSelector)
			.on("set", this.setTvVolume.bind(this));

		// Publish our device as external accessory, to be paired manually, as requested
		// by TELEVISION category platform.
		this.api.publishExternalAccessories(PLUGIN_NAME, [this.tvPlatform]);
	}
	// Input source add helper
	addInputSource(identifier, name, confname, type, callback) {
		const inputSource = this.tvPlatform.addService(this.Service.InputSource, name, confname);
		inputSource
			.setCharacteristic(this.Characteristic.Identifier, identifier)
			.setCharacteristic(this.Characteristic.ConfiguredName, confname)
			.setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED)
			.setCharacteristic(this.Characteristic.InputSourceType, type);
		callback(null, inputSource);
	}

	// Determine TV power status
	getTvPowerState(callback) {
		FreeboxPlayerDelta.CheckIfAlive(this.config.hostname, this.log,
			(err, ok) => {
				if (err) {
					this.log.error("Getting power state failed: " + err);
				}
				this.tvPowerState = (!err && ok) ? (this.Characteristic.Active.ACTIVE) : (this.Characteristic.Active.INACTIVE);
				callback(err, this.tvPowerState);
			});
	}

	// Set TV power ON/OFF
	setTvPowerState(state, callback) {
		if (this.tvPowerState != state) {
			FreeboxPlayerDelta.SendNetworkRemoteKey(this.config.hostname, this.config.code, PLAYER_POWER, this.log,
				(err, ok) => {
					if (!err && ok) {
						this.tvPowerState = (state) ? (this.Characteristic.Active.ACTIVE) : (this.Characteristic.Active.INACTIVE);
						this.tvService.updateCharacteristic(this.Characteristic.Active, this.tvPowerState);
						this.speakerService.updateCharacteristic(this.Characteristic.Mute, !state);

					} else {
						this.log.error("Setting power state failed: " + JSON.stringify(err));
					}
					callback(err);
				});
		} else {
			this.log.debug("Power state switch request bypassed because Player is already at target power state: " + this.tvPowerState + " = " + state);
			callback(null);
		}
	}

	// Set TV remote key
	setTvRemoteKey(key, callback) {
		FreeboxPlayerDelta.SendNetworkRemoteKey(this.config.hostname, this.config.code, this.remoteKeyMapping.get(key), this.log,
			(err) => {
				if (err) {
					this.log.error("Sending remote key to player failed: " + JSON.stringify(err));
				}
				callback(err);
			});
	}

	// Switch TV input source
	setTvInputSource(source, callback) {
		FreeboxPlayerDelta.SendNetworkRemoteKey(this.config.hostname, this.config.code, this.inputSourceMapping.get(source), this.log,
			(err) => {
				if (err) {
					this.log.error("Switching player input source failed: " + JSON.stringify(err));
				}
				callback(err);
			});
	}

	// Get TV speaker mute state
	getTvMuteState(callback) {
		this.getTvPowerState( (err, ok) => { callback(err, !ok); } );
	}

	// Set TV speaker volume
	setTvVolume(val, callback) {
		const volkey = (val === this.Characteristic.VolumeSelector.INCREMENT) ? (PLAYER_VOLUME_UP) : (PLAYER_VOLUME_DOWN);
		FreeboxPlayerDelta.SendNetworkRemoteKey(this.config.hostname, this.config.code, volkey, this.log,
			(err) => {
				if (err) {
					this.log.error("Changing player volume failed: " + JSON.stringify(err));
				}
				callback(err);
			});
	}

	// Check if player is alive
	static CheckIfAlive(hostname, logger, callback) {
		tcpp.ping({address: hostname, port: TCP_ALIVE_CHECK_PORT, timeout: TCP_ALIVE_TIMEOUT, attempts: TCP_ALIVE_ATTEMPTS},
			(err, data) => {
				logger.debug("Power state check: " + JSON.stringify(err) + ", " + JSON.stringify(data));
				callback(err, !err && (data.min !== undefined));
			});
	}

	// Send remote key to player network remote API
	static SendNetworkRemoteKey(hostname, code, key, logger, callback) {
		request.get("http://" + hostname + "/pub/remote_control?code=" + code + "&key=" + key,
			(err, resp) => {
				logger.debug("Remote command '" + key + "' sent to '" + hostname + "' (" + key + "):" + JSON.stringify(err) + ", " + (resp && resp.statusCode));
				callback(err, !err && resp && resp.statusCode == 200);
			});
	}
}
