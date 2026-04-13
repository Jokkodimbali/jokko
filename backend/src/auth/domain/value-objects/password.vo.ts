export class Password {
  private constructor(private readonly value: string) {}

  static create(raw: string): { success: boolean; error?: string } {
    if (!raw) {
      return { success: false, error: 'Le mot de passe est obligatoire' };
    }

    if (raw.length < 8) {
      return {
        success: false,
        error: 'Le mot de passe doit contenir au moins 8 caractères',
      };
    }

    if (raw.length > 64) {
      return {
        success: false,
        error: 'Le mot de passe ne doit pas dépasser 64 caractères',
      };
    }

    return { success: true };
  }

  static createSecure(raw: string): Password | null {
    const result = Password.create(raw);
    return result.success ? new Password(raw) : null;
  }

  getValue(): string {
    return this.value;
  }

  meetsStrengthRequirements(): boolean {
    const hasUpperCase = /[A-Z]/.test(this.value);
    const hasLowerCase = /[a-z]/.test(this.value);
    const hasNumber = /[0-9]/.test(this.value);
    const hasSpecialChar = /[!@#$%^&*()_+\-={};'"|,.<>?]/.test(this.value);

    const strengthScore = [
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      hasSpecialChar,
    ].filter(Boolean).length;
    return strengthScore >= 3;
  }

  getStrengthScore(): number {
    let score = 0;

    if (this.value.length >= 8) score++;
    if (this.value.length >= 12) score++;
    if (/[A-Z]/.test(this.value)) score++;
    if (/[a-z]/.test(this.value)) score++;
    if (/[0-9]/.test(this.value)) score++;
    if (/[!@#$%^&*()_+\-={};'"|,.<>?]/.test(this.value)) score++;

    return score;
  }
}
