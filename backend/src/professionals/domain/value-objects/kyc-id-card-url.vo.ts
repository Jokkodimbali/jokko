export class KycIdCardUrl {
  private constructor(private readonly value: string) {}

  static create(raw: string): KycIdCardUrl {
    return new KycIdCardUrl(raw.trim());
  }

  getValue(): string {
    return this.value;
  }
}
