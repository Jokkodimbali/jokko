import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { DoctorSpaceService } from '../../../data-access/doctor-space.service';
import { PrescriptionTemplateEditorComponent } from './prescription-template-editor.component';

describe('PrescriptionTemplateEditorComponent', () => {
  it('loads and uploads without changing disabled during the same check', async () => {
    let uploadedFile: File | null = null;
    TestBed.configureTestingModule({
      imports: [PrescriptionTemplateEditorComponent],
      providers: [
        {
          provide: DoctorSpaceService,
          useValue: {
            getMyPrescriptionTemplate: () => of(null),
            uploadProfessionalAsset: (file: File) => {
              uploadedFile = file;
              return of({
                fileUrl:
                  'https://res.cloudinary.com/demo/image/upload/v1/jokko/professionals/logo.png',
                imageUrl:
                  'https://res.cloudinary.com/demo/image/upload/v1/jokko/professionals/logo.png',
                originalFileName: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
              });
            },
          },
        },
        { provide: AppFeedbackService, useValue: { error: () => undefined } },
      ],
    });

    const fixture = TestBed.createComponent(PrescriptionTemplateEditorComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);

    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(false);

    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    expect(
      (fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement).checked,
    ).toBe(false);
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(uploadedFile).toBe(file);
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(false);
    expect(
      fixture.nativeElement.querySelector('.prescription-editor__asset-preview img'),
    ).not.toBeNull();
  });
});
