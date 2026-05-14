import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {

  errorMsg = '';
  selectedFiles: Record<string, File | null> = {};
  keys = ['pdf1', 'pdf2', 'pdf3', 'pdf4', 'pdf5'];
  labelMap: Record<string, string> = {};
  uploadForm: any;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    const group: Record<string, any> = {};
    this.keys.forEach((k, i) => {
      group[k] = [null];
      this.selectedFiles[k] = null;
      this.labelMap[k] = `PDF ${i + 1}`;
    });
    this.uploadForm = this.fb.group(group);
  }

  // --- helpers to keep code small and DRY ---
  private validateFile = (file: File) => {
    if (!file) return 'No file provided';
    if (file.type !== 'application/pdf') return 'Only PDF allowed';
    if (file.size > 5 * 1024 * 1024) return 'File exceeds 5MB';
    return null;
  };

  private findNextEmptyKey = () => this.keys.find(k => !this.selectedFiles[k]) || null;

  private addFileToKey(file: File, preferredKey?: string) {
    const v = this.validateFile(file);
    if (v) { this.errorMsg = v; return false; }
    if (this.keys.some(k => { const f = this.selectedFiles[k]; return !!f && f.name === file.name && f.size === file.size && f.lastModified === file.lastModified; })) {
      this.errorMsg = 'This file has already been selected'; return false;
    }
    const filled = this.keys.filter(k => !!this.selectedFiles[k]).length;
    const isPreferredEmpty = preferredKey ? !this.selectedFiles[preferredKey] : false;
    if (filled >= this.keys.length && !isPreferredEmpty) { this.errorMsg = 'Maximum 5 files already selected'; return false; }
    const target = preferredKey && this.keys.includes(preferredKey) ? preferredKey : this.findNextEmptyKey();
    if (!target) { this.errorMsg = 'All slots filled'; return false; }
    this.selectedFiles[target] = file; this.uploadForm.patchValue({ [target]: file }); this.errorMsg = ''; return true;
  }

  onFileChange(event: any, key: string) {
    const file: File = event.target.files?.[0];
    if (!file) return;
    this.addFileToKey(file, key);
    event.target.value = '';
  }

  onFilesChange(event: any) {
    const files: File[] = Array.from(event.target.files || []);
    if (!files.length) { event.target.value = ''; return; }
    if (files.length > 5) { this.errorMsg = 'Maximum 5 files allowed'; event.target.value = ''; return; }

    for (const f of files) {
      const next = this.findNextEmptyKey();
      if (!next) { this.errorMsg = 'All 5 slots are already filled'; break; }
      if (!this.addFileToKey(f, next)) break;
    }
    event.target.value = '';
  }

  clearKey(key: string) {
    this.selectedFiles[key] = null;
    this.uploadForm.patchValue({ [key]: null });
  }

  clearAll() {
    this.keys.forEach(k => this.clearKey(k));
    this.errorMsg = '';
  }

  get filledCount() { return this.keys.filter(k => !!this.selectedFiles[k]).length; }
  get isDuplicateError() { return !!this.errorMsg && /already been selected/i.test(this.errorMsg); }
  get isWarningError() { return !!this.errorMsg && /(all 5 slots are already filled|maximum 5 files|maximum 5 files allowed)/i.test(this.errorMsg); }

  // submission state and success message
  submitting = false;
  successMsg = '';
  submit() {

    // ensure at least one PDF has been selected before submitting
    const uploadedCount = this.keys.filter(k => !!this.selectedFiles[k]).length;
    if (uploadedCount < 1) {
      this.errorMsg = 'Please upload at least one PDF before submitting';
      return;
    }

    // If form fields are invalid, mark them to show validation messages, but
    // don't block the upload since at least one PDF is present.
    if (this.uploadForm.invalid) {
      this.uploadForm.markAllAsTouched();
      console.warn('Form has validation errors but proceeding because at least one file is selected.');
    }

    // prepare FormData with only the selected files
    this.errorMsg = '';
    const payload = new FormData();
    const readableEntries: any[] = [];

    for (const k of this.keys) {
      const f = this.selectedFiles[k];
      if (f) {
        const fieldName = `${k}Pdf`; // e.g. pdf1Pdf, pdf2Pdf
        payload.append(fieldName, f);
        readableEntries.push({ field: fieldName, file: { name: f.name, type: f.type, size: f.size } });
      }
    }

    // log what will be sent so you can see a clear console record
    console.log('Sending FormData payload:', readableEntries);

    this.submitting = true;
    this.successMsg = '';
    this.http.post('https://jsonplaceholder.typicode.com/posts', payload)
      .subscribe({
        next: (res) => {
          console.log('POST success:', res);
          this.successMsg = 'Files uploaded successfully';
          // clear success after 4s
          setTimeout(() => (this.successMsg = ''), 4000);
          this.submitting = false;
        },
        error: (err) => {
          console.error('POST error:', err);
          this.errorMsg = 'Upload failed';
          this.submitting = false;
        }
      });

  }

}