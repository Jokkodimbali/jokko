import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  AdminCategoryPayload,
  AdminServiceSubCategory,
  AdminServiceStructureCategory,
  AdminServiceStructureReport,
  AdminSubCategoryPayload,
} from '../../../data-access/admin.models';
import { AdminDashboardService } from '../../../data-access/admin-dashboard.service';

type CategoryForm = {
  id: string | null;
  name: string;
  iconUrl: string;
  sortOrder: number;
  commissionRate: number;
};

type ModalMode =
  | 'category'
  | 'bulk-categories'
  | 'subcategory'
  | 'bulk-subcategories'
  | 'assign-subcategories'
  | 'confirm-disable-category'
  | null;

@Component({
  selector: 'app-admin-service-structure-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin-service-structure-panel.component.html',
  styleUrl: './admin-service-structure-panel.component.scss',
})
export class AdminServiceStructurePanelComponent {
  private readonly adminService = inject(AdminDashboardService);

  @Input() report: AdminServiceStructureReport | null = null;
  @Input() isLoading = false;
  @Input() actionId: string | null = null;

  @Output() createCategory = new EventEmitter<AdminCategoryPayload>();
  @Output() updateCategory = new EventEmitter<{ categoryId: string; payload: AdminCategoryPayload }>();
  @Output() disableCategory = new EventEmitter<string>();
  @Output() bulkCreateCategories = new EventEmitter<AdminCategoryPayload[]>();
  @Output() createSubCategory = new EventEmitter<AdminSubCategoryPayload>();
  @Output() bulkCreateSubCategories = new EventEmitter<AdminSubCategoryPayload[]>();
  @Output() assignSubCategories = new EventEmitter<{ categoryId: string; subCategoryIds: string[] }>();

  protected expandedCategoryId: string | null = null;
  protected modalMode: ModalMode = null;
  protected form: CategoryForm = this.emptyForm();
  protected bulkCategoriesText = '';
  protected subCategoryForm: AdminSubCategoryPayload = this.emptySubCategoryForm();
  protected bulkSubCategoriesText = '';
  protected assignmentCategory: AdminServiceStructureCategory | null = null;
  protected categoryPendingDisable: AdminServiceStructureCategory | null = null;
  protected selectedSubCategoryIds = new Set<string>();
  protected isUploadingImage = false;

  protected visibleCategories(report: AdminServiceStructureReport): AdminServiceStructureCategory[] {
    return report.categories;
  }

  protected toggleCategory(categoryId: string): void {
    this.expandedCategoryId = this.expandedCategoryId === categoryId ? null : categoryId;
  }

  protected openCreateForm(): void {
    this.form = this.emptyForm();
    this.modalMode = 'category';
  }

  protected openEditForm(category: AdminServiceStructureCategory): void {
    this.form = {
      id: category.id,
      name: category.name,
      iconUrl: category.iconUrl ?? '',
      sortOrder: category.sortOrder,
      commissionRate: category.commissionRate,
    };
    this.modalMode = 'category';
  }

  protected openBulkCategoryForm(): void {
    this.bulkCategoriesText = '';
    this.modalMode = 'bulk-categories';
  }

  protected openSubCategoryForm(category?: AdminServiceStructureCategory): void {
    this.subCategoryForm = this.emptySubCategoryForm();
    this.modalMode = 'subcategory';
    if (category) {
      this.expandedCategoryId = category.id;
    }
  }

  protected openBulkSubCategoryForm(): void {
    this.bulkSubCategoriesText = '';
    this.modalMode = 'bulk-subcategories';
  }

  protected openAssignmentForm(category: AdminServiceStructureCategory): void {
    this.assignmentCategory = category;
    this.selectedSubCategoryIds = new Set(category.subCategories.map((subCategory) => subCategory.id));
    this.modalMode = 'assign-subcategories';
  }

  protected closeModal(): void {
    this.modalMode = null;
    this.form = this.emptyForm();
    this.subCategoryForm = this.emptySubCategoryForm();
    this.assignmentCategory = null;
    this.categoryPendingDisable = null;
    this.selectedSubCategoryIds.clear();
  }

  protected submitForm(): void {
    const payload: AdminCategoryPayload = {
      name: this.form.name.trim(),
      iconUrl: this.form.iconUrl.trim() || null,
      sortOrder: Number(this.form.sortOrder || 0),
      commissionRate: Number(this.form.commissionRate || 0),
    };

    if (!payload.name) return;

    if (this.form.id) {
      this.updateCategory.emit({ categoryId: this.form.id, payload });
      this.closeModal();
      return;
    }

    this.createCategory.emit(payload);
    this.closeModal();
  }

  protected submitBulkCategories(): void {
    const payload = this.parseLines(this.bulkCategoriesText).map((line, index) => ({
      name: line,
      iconUrl: null,
      sortOrder: index,
      commissionRate: 10,
    }));

    if (payload.length === 0) return;
    this.bulkCreateCategories.emit(payload);
    this.closeModal();
  }

  protected submitSubCategory(): void {
    const payload: AdminSubCategoryPayload = {
      name: this.subCategoryForm.name.trim(),
      description: this.subCategoryForm.description?.trim() || null,
      sortOrder: Number(this.subCategoryForm.sortOrder || 0),
    };

    if (!payload.name) return;
    this.createSubCategory.emit(payload);
    this.closeModal();
  }

  protected submitBulkSubCategories(): void {
    const payload = this.parseLines(this.bulkSubCategoriesText).map((line, index) => {
      const [name, description] = line.split('|').map((part) => part.trim());
      return {
        name,
        description: description || null,
        sortOrder: index,
      };
    }).filter((item) => item.name.length > 0);

    if (payload.length === 0) return;
    this.bulkCreateSubCategories.emit(payload);
    this.closeModal();
  }

  protected submitAssignments(): void {
    if (!this.assignmentCategory) return;
    this.assignSubCategories.emit({
      categoryId: this.assignmentCategory.id,
      subCategoryIds: Array.from(this.selectedSubCategoryIds),
    });
    this.closeModal();
  }

  protected toggleSubCategorySelection(subCategory: AdminServiceSubCategory): void {
    if (this.selectedSubCategoryIds.has(subCategory.id)) {
      this.selectedSubCategoryIds.delete(subCategory.id);
      return;
    }
    this.selectedSubCategoryIds.add(subCategory.id);
  }

  protected isSubCategorySelected(subCategory: AdminServiceSubCategory): boolean {
    return this.selectedSubCategoryIds.has(subCategory.id);
  }

  protected uploadIcon(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isUploadingImage = true;
    this.adminService.uploadServiceCategoryImage(file).subscribe({
      next: ({ imageUrl }) => {
        this.form.iconUrl = imageUrl;
        this.isUploadingImage = false;
        input.value = '';
      },
      error: () => {
        this.isUploadingImage = false;
        input.value = '';
      },
    });
  }

  protected requestDisable(category: AdminServiceStructureCategory): void {
    if (!category.isActive || this.actionId === category.id) return;
    this.categoryPendingDisable = category;
    this.modalMode = 'confirm-disable-category';
  }

  protected confirmDisableCategory(): void {
    if (!this.categoryPendingDisable) return;
    this.disableCategory.emit(this.categoryPendingDisable.id);
    this.closeModal();
  }

  protected subCategoryCount(category: AdminServiceStructureCategory): number {
    return category.subCategories.length;
  }

  protected categoryIconName(category: AdminServiceStructureCategory): string {
    const normalized = category.name.toLowerCase();
    if (normalized.includes('electric')) return 'power';
    if (normalized.includes('plomberie') || normalized.includes('sanitaire')) return 'wrench';
    if (normalized.includes('menuiser') || normalized.includes('metal')) return 'archive';
    return 'git-fork';
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(value || 0));
  }

  protected formatDuration(min: number, max: number): string {
    if (min === max) return `${min} min`;
    return `${min}-${max} min`;
  }

  protected formatPriceRange(min: number, max: number): string {
    if (min === max) return `${this.formatMoney(min)} FCFA`;
    return `${this.formatMoney(min)}-${this.formatMoney(max)} FCFA`;
  }

  protected categoryTrackBy(_: number, category: AdminServiceStructureCategory): string {
    return category.id;
  }

  private emptyForm(): CategoryForm {
    return {
      id: null,
      name: '',
      iconUrl: '',
      sortOrder: 0,
      commissionRate: 10,
    };
  }

  private emptySubCategoryForm(): AdminSubCategoryPayload {
    return {
      name: '',
      description: null,
      sortOrder: 0,
    };
  }

  private parseLines(value: string): string[] {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
}
