import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject } from '@angular/core';

type ValidatableField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

@Injectable({ providedIn: 'root' })
export class InlineFormValidationService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private installed = false;
  private readonly onBlur = (event: Event) => this.validateEventField(event, true);
  private readonly onInput = (event: Event) => this.validateEventField(event, false);
  private readonly onInvalid = (event: Event) => this.validateEventField(event, true);
  private readonly onSubmit = (event: Event) => this.validateSubmittedForm(event);

  install(): void {
    if (this.installed) return;
    this.installed = true;
    this.document.addEventListener('blur', this.onBlur, true);
    this.document.addEventListener('input', this.onInput, true);
    this.document.addEventListener('change', this.onInput, true);
    this.document.addEventListener('invalid', this.onInvalid, true);
    this.document.addEventListener('submit', this.onSubmit, true);
  }

  ngOnDestroy(): void {
    if (!this.installed) return;
    this.document.removeEventListener('blur', this.onBlur, true);
    this.document.removeEventListener('input', this.onInput, true);
    this.document.removeEventListener('change', this.onInput, true);
    this.document.removeEventListener('invalid', this.onInvalid, true);
    this.document.removeEventListener('submit', this.onSubmit, true);
  }

  private validateEventField(event: Event, forceDisplay: boolean): void {
    const field = this.asField(event.target);
    if (!field) return;

    const alreadyDisplayed = Boolean(this.errorElement(field));
    if (this.isInvalid(field) && (forceDisplay || alreadyDisplayed)) {
      this.displayError(field);
      return;
    }

    if (!this.isInvalid(field)) this.clearError(field);
  }

  private validateSubmittedForm(event: Event): void {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    form.querySelectorAll('input, textarea, select').forEach((element) => {
      const field = this.asField(element);
      if (field && this.isInvalid(field)) this.displayError(field);
    });
  }

  private asField(target: EventTarget | null): ValidatableField | null {
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      if (target.closest('form[data-inline-validation="off"]')) {
        return null;
      }
      if (
        target instanceof HTMLInputElement &&
        ['hidden', 'button', 'submit', 'reset'].includes(target.type)
      ) {
        return null;
      }
      return target.disabled ? null : target;
    }
    return null;
  }

  private isInvalid(field: ValidatableField): boolean {
    return !field.checkValidity() || field.classList.contains('ng-invalid');
  }

  private displayError(field: ValidatableField): void {
    const id = field.dataset['inlineValidationId'] || `field-validation-${crypto.randomUUID()}`;
    field.dataset['inlineValidationId'] = id;

    let error = this.errorElement(field);
    if (!error) {
      error = this.document.createElement('small');
      error.id = id;
      error.className = 'app-inline-field-error';
      error.setAttribute('role', 'alert');
      field.insertAdjacentElement('afterend', error);
    }

    error.textContent = this.validationMessage(field);
    field.classList.add('app-field--invalid');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute(
      'aria-describedby',
      this.appendId(field.getAttribute('aria-describedby'), id),
    );
  }

  private clearError(field: ValidatableField): void {
    const id = field.dataset['inlineValidationId'];
    this.errorElement(field)?.remove();
    field.classList.remove('app-field--invalid');
    field.removeAttribute('aria-invalid');
    if (id) {
      const describedBy = field
        .getAttribute('aria-describedby')
        ?.split(/\s+/)
        .filter((value) => value && value !== id)
        .join(' ');
      describedBy
        ? field.setAttribute('aria-describedby', describedBy)
        : field.removeAttribute('aria-describedby');
    }
  }

  private errorElement(field: ValidatableField): HTMLElement | null {
    const id = field.dataset['inlineValidationId'];
    return id ? this.document.getElementById(id) : null;
  }

  private validationMessage(field: ValidatableField): string {
    const customMessage = field.dataset['validationMessage'];
    if (customMessage) return customMessage;

    const validity = field.validity;
    if (validity.valueMissing) return 'Ce champ est obligatoire.';
    if (validity.typeMismatch && field instanceof HTMLInputElement && field.type === 'email') {
      return 'Saisissez une adresse e-mail valide, par exemple nom@domaine.com.';
    }
    if (validity.typeMismatch && field instanceof HTMLInputElement && field.type === 'url') {
      return 'Saisissez une adresse web valide.';
    }
    if (validity.tooShort && !(field instanceof HTMLSelectElement)) {
      return `Saisissez au moins ${field.minLength} caracteres.`;
    }
    if (validity.tooLong && !(field instanceof HTMLSelectElement)) {
      return `Saisissez au maximum ${field.maxLength} caracteres.`;
    }
    if (validity.rangeUnderflow && field instanceof HTMLInputElement) {
      return `La valeur minimale autorisee est ${field.min}.`;
    }
    if (validity.rangeOverflow && field instanceof HTMLInputElement) {
      return `La valeur maximale autorisee est ${field.max}.`;
    }
    if (validity.patternMismatch) return 'Le format saisi n’est pas valide.';
    if (validity.stepMismatch || validity.badInput) return 'Saisissez une valeur valide.';
    return 'Verifiez cette information avant de continuer.';
  }

  private appendId(currentValue: string | null, id: string): string {
    const values = new Set((currentValue || '').split(/\s+/).filter(Boolean));
    values.add(id);
    return [...values].join(' ');
  }
}
