const PLUGIN_NAME = 'homebridge-freebox-player';
const PLATFORM_NAME = 'HomebridgeFreeboxPlayer';
const request = require('request');

module.exports = (api) => {
    api.registerPlatform(PLATFORM_NAME, FreeboxPlayerPlugin);
}

class FreeboxPlayerPlugin {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;

        this.Service = api.hap.Service;
        this.Characteristic = api.hap.Characteristic;

        const tvName = 'Freebox Player'
        const uuid = this.api.hap.uuid.generate('homebridge:my-tv-plugin' + tvName);
        this.tvAccessory = new api.platformAccessory(tvName, uuid);
        this.tvAccessory.category = this.api.hap.Categories.TELEVISION;

        const tvService = this.tvAccessory.addService(this.Service.Television);
        tvService.setCharacteristic(this.Characteristic.ConfiguredName, tvName);
        tvService.setCharacteristic(this.Characteristic.SleepDiscoveryMode, this.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);

        // handle on / off
        tvService.getCharacteristic(this.Characteristic.Active)
            .on('set', (newValue, callback) => {
                this.requestRemoteKey('power');
                tvService.updateCharacteristic(this.Characteristic.Active, 1);
                callback(null);
            });

        tvService.setCharacteristic(this.Characteristic.ActiveIdentifier, 1);

        // handle input source changes
        tvService.getCharacteristic(this.Characteristic.ActiveIdentifier)
            .on('set', (newValue, callback) => {
                this.requestSource(newValue);
                callback(null);
            });

        // handle remote control input
        tvService.getCharacteristic(this.Characteristic.RemoteKey)
            .on('set', (newValue, callback) => {
                switch (newValue) {
                    case this.Characteristic.RemoteKey.REWIND: {
                        this.requestRemoteKey('bwd');
                        break;
                    }
                    case this.Characteristic.RemoteKey.FAST_FORWARD: {
                        this.requestRemoteKey('fwd');
                        break;
                    }
                    case this.Characteristic.RemoteKey.NEXT_TRACK: {
                        this.requestRemoteKey('fwd');
                        break;
                    }
                    case this.Characteristic.RemoteKey.PREVIOUS_TRACK: {
                        this.requestRemoteKey('bwd');
                        break;
                    }
                    case this.Characteristic.RemoteKey.ARROW_UP: {
                        this.requestRemoteKey('up');
                        break;
                    }
                    case this.Characteristic.RemoteKey.ARROW_DOWN: {
                        this.requestRemoteKey('down');
                        break;
                    }
                    case this.Characteristic.RemoteKey.ARROW_LEFT: {
                        this.requestRemoteKey('left');
                        break;
                    }
                    case this.Characteristic.RemoteKey.ARROW_RIGHT: {
                        this.requestRemoteKey('right');
                        break;
                    }
                    case this.Characteristic.RemoteKey.SELECT: {
                        this.requestRemoteKey('ok');
                        break;
                    }
                    case this.Characteristic.RemoteKey.BACK: {
                        this.requestRemoteKey('red');
                        break;
                    }
                    case this.Characteristic.RemoteKey.EXIT: {
                        this.requestRemoteKey('red');
                        break;
                    }
                    case this.Characteristic.RemoteKey.PLAY_PAUSE: {
                        this.requestRemoteKey('play');
                        break;
                    }
                    case this.Characteristic.RemoteKey.INFORMATION: {
                        this.requestRemoteKey('yellow');
                        break;
                    }
                }
                callback(null);
            });

        const speakerService = this.tvAccessory.addService(this.Service.TelevisionSpeaker);

        speakerService
            .setCharacteristic(this.Characteristic.Active, this.Characteristic.Active.ACTIVE)
            .setCharacteristic(this.Characteristic.VolumeControlType, this.Characteristic.VolumeControlType.ABSOLUTE);

        // handle volume control
        speakerService.getCharacteristic(this.Characteristic.VolumeSelector)
            .on('set', (newValue, callback) => {
                if (newValue == 0) {
                    this.requestRemoteKey('vol_inc')
                } else {
                    this.requestRemoteKey('vol_dec')
                }
                callback(null);
            });


        if (this.config.appsShortcutEnabled) {
            // HDMI 1 Input Source
            const hdmi1InputService = this.tvAccessory.addService(this.Service.InputSource, '-', '-');
            hdmi1InputService
                .setCharacteristic(this.Characteristic.Identifier, 1)
                .setCharacteristic(this.Characteristic.ConfiguredName, '-')
                .setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.HDMI);
            tvService.addLinkedService(hdmi1InputService); // link to tv service

            // HDMI 2 Input Source
            const hdmi2InputService = this.tvAccessory.addService(this.Service.InputSource, 'home', 'Home');
            hdmi2InputService
                .setCharacteristic(this.Characteristic.Identifier, 2)
                .setCharacteristic(this.Characteristic.ConfiguredName, 'Home')
                .setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.HDMI);
            tvService.addLinkedService(hdmi2InputService); // link to tv service

            // Netflix Input Source
            const netflixInputService = this.tvAccessory.addService(this.Service.InputSource, 'netflix', 'Netflix');
            netflixInputService
                .setCharacteristic(this.Characteristic.Identifier, 3)
                .setCharacteristic(this.Characteristic.ConfiguredName, 'Netflix')
                .setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.HDMI);
            tvService.addLinkedService(netflixInputService); // link to tv service

            // YouTube Input Source
            const youTubeInputService = this.tvAccessory.addService(this.Service.InputSource, 'youTube', 'YouTube');
            youTubeInputService
                .setCharacteristic(this.Characteristic.Identifier, 4)
                .setCharacteristic(this.Characteristic.ConfiguredName, 'YouTube')
                .setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.HDMI);
            tvService.addLinkedService(youTubeInputService); // link to tv service
        }

        this.api.publishExternalAccessories(PLUGIN_NAME, [this.tvAccessory]);
        this.netflixKeys = ['home', 'home', 'left', 'left', 'left', 'left', 'left', 'left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'down', 'down', 'ok'];
        this.youtubeKeys = ['home', 'home', 'left', 'left', 'left', 'left', 'left', 'left', 'left', 'left', 'right', 'right', 'ok'];
        this.keyCounter = 0
    }

    requestRemoteKey(key, callback) {
        let url = 'http://hd1.freebox.fr/pub/remote_control?key=' + key + '&code=' + this.config.code;
        //console.log(url);
        request(url, function (error, response, body) {
            if (callback != null) {
                callback();
            }
        });
    }

    requestSource(source) {
        //console.log('[Source] Requested ' + source);
        if (source == 2) {
            this.requestRemoteKey('home')
        }
        if (source == 3) {
            this.jumpMenu(this.netflixKeys);
        }
        if (source == 4) {
            this.jumpMenu(this.youtubeKeys);
        }
    }

    jumpMenu(path) {
        if (this.keyCounter == path.length) {
            this.keyCounter = 0;
            return;
        }
        let key = path[this.keyCounter]
        //console.log('requesting '+key);
        this.requestRemoteKey(key, () => {
            this.keyCounter = this.keyCounter + 1;
            this.jumpMenu(path);
        })
    }
}