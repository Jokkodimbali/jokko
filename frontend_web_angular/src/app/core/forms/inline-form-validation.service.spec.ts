import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InlineFormValidationService } from './inline-form-validation.service';

describe('InlineFormValidationService', () => {
  let service: InlineFormValidationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InlineFormValidationService);
    service.install();
  });

  afterEach(() => {
    service.ngOnDestroy();
    document.body.replaceChildren();
    TestBed.resetTestingModule();
  });

  it('handles an invalid event without dispatching validation recursively', () => {
    const input = document.createElement('input');
    input.required = true;
    input.dataset['inlineValidationId'] = 'required-field-error';
    const checkValidity = vi.spyOn(input, 'checkValidity');
    document.body.append(input);

    input.dispatchEvent(new Event('invalid', { bubbles: false, cancelable: true }));

    expect(checkValidity).not.toHaveBeenCalled();
    expect(document.getElementById('required-field-error')?.textContent).toBe(
      'Ce champ est obligatoire.',
    );
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
