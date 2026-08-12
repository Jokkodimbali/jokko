export class LatestPendingValue<T> {
  private value: T | null = null;

  replace(value: T): void {
    this.value = value;
  }

  take(): T | null {
    const value = this.value;
    this.value = null;
    return value;
  }

  clear(): void {
    this.value = null;
  }
}
