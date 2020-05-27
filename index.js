const PLUGIN_NAME = 'homebridge-freebox-player';
const PLATFORM_NAME = 'HomebridgeFreeboxPlayer';

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

        // HDMI 1 Input Source
        const hdmi1InputService = this.tvAccessory.addService(this.Service.InputSource, 'hdmi1', 'HDMI 1');
        hdmi1InputService
            .setCharacteristic(this.Characteristic.Identifier, 1)
            .setCharacteristic(this.Characteristic.ConfiguredName, 'HDMI 1')
            .setCharacteristic(this.Characteristic.IsConfigured, this.Characteristic.IsConfigured.CONFIGURED)
            .setCharacteristic(this.Characteristic.InputSourceType, this.Characteristic.InputSourceType.HDMI);
        tvService.addLinkedService(hdmi1InputService); // link to tv service

        // HDMI 2 Input Source
        const hdmi2InputService = this.tvAccessory.addService(this.Service.InputSource, 'hdmi2', 'HDMI 2');
        hdmi2InputService
            .setCharacteristic(this.Characteristic.Identifier, 2)
            .setCharacteristic(this.Characteristic.ConfiguredName, 'HDMI 2')
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

        this.api.publishExternalAccessories(PLUGIN_NAME, [this.tvAccessory]);
    }

    requestRemoteKey(key) {
        console.log('[Remote]['+this.config.code+'] Requested ' + key)
    }

    requestSource(source) {
        console.log('[Source] Requested ' + source)
    }
}