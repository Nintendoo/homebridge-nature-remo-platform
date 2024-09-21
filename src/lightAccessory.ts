import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { NatureRemoPlatform } from './platform';

export class NatureNemoLightAccessory {
  private readonly service: Service;
  private readonly name: string;
  private readonly id: string;
  private readonly signalId: string | null;

  constructor(
    private readonly platform: NatureRemoPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.name = this.accessory.context.appliance.nickname;
    this.id = this.accessory.context.appliance.id;
    this.signalId = this.accessory.context.appliance.signals[0]?.id ?? null;
    this.accessory.category = this.platform.api.hap.Categories.LIGHTBULB;

    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, this.accessory.context.appliance.model.manufacturer)
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.appliance.model.name)
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.accessory.context.appliance.device.firmware_version)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.id)
      .setCharacteristic(this.platform.Characteristic.Name, this.name);

    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.getOn.bind(this))
      .onSet(this.setOn.bind(this));
    if (this.signalId) {
      this.platform.logger.info('[%s] id -> %s, Brightness enabled', this.name, this.id);

      this.service.getCharacteristic(this.platform.Characteristic.Brightness)
        .onGet(this.getBrightness.bind(this))
        .onSet(this.setBrightness.bind(this));
    }


    this.platform.logger.debug('[%s] id -> %s', this.name, this.id);
  }

  async getOn(): Promise<CharacteristicValue> {
    this.platform.logger.debug('getOn called');
    const lightState = await this.platform.natureRemoApi.getLightState(this.id);
    this.platform.logger.info('[%s] Power -> %s', this.name, lightState.power);
    return lightState.power === 'on';
  }

  async setOn(value: CharacteristicValue): Promise<void> {
    this.platform.logger.debug('setOn called ->', value);
    if (value !== 'on' && value !== 'off' && value !== 'night' && value !== 'on-favorite') {
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.INVALID_VALUE_IN_REQUEST);
    }
    const power = value;
    await this.platform.natureRemoApi.setLight(this.id, power);
    this.platform.logger.info('[%s] Power <- %s', this.name, power);
  }

  async getBrightness(): Promise<CharacteristicValue> {
    /*
    this.platform.logger.info('getBrightness called');
    const lightState = await this.platform.natureRemoApi.getLightState(this.id);
    this.platform.logger.info('[%s] Brightness -> %s', this.name, lightState.brightness);
    if(lightState.brightness === "favorite") {
      return 20;
    }
    if( isNaN(Number(lightState.brightness))) {
      return 0;
    }
    return lightState.brightness;
    */
    return 50;
  }

  async setBrightness(value: CharacteristicValue): Promise<void> {
    this.platform.logger.info('setBrightness called ->', value);
    if (typeof value !== 'number') {
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.INVALID_VALUE_IN_REQUEST);
    }
    if (value < 1) {
      this.platform.logger.debug('[%s] Brightness <- %s', this.name, 'Off');
      await this.setOn('off');
    } else if (value < 20) {
      this.platform.logger.debug('[%s] Brightness <- %s', this.name, 'Low');
      await this.setOn('night');
    } else if (value < 50) {
      this.platform.logger.debug('[%s] Brightness <- %s', this.name, 'Mid');
      await this.setOn('on');
    } else {
      this.platform.logger.debug('[%s] Brightness <- %s', this.name, 'Max');
      await this.platform.natureRemoApi.sendSignal(this.signalId!);
    }
  }

}
