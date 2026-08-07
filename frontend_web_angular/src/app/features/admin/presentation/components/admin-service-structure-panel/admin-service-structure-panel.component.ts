import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  AdminCategoryPayload,
  AdminServiceSubCategory,
  AdminServiceStructureCategory,
  AdminServiceStructureReport,
  AdminSubCategoryPayload,
} from '../../../data-access/admin.models';

type CategoryForm = {
  id: string | null;
  name: string;
  iconUrl: string;
  sortOrder: number;
  commissionRate: number;
};

type IconOption = {
  token: `lucide:${string}`;
  icon: string;
  label: string;
  keywords: string[];
};

type ModalMode =
  | 'category'
  | 'bulk-categories'
  | 'subcategory'
  | 'bulk-subcategories'
  | 'assign-subcategories'
  | 'confirm-disable-category'
  | 'confirm-activate-category'
  | 'confirm-delete-category'
  | 'confirm-delete-subcategory'
  | null;

type CategoryFilter =
  | 'all'
  | 'active'
  | 'inactive'
  | 'with-subcategories'
  | 'without-subcategories'
  | 'with-services'
  | 'without-services';
type SubCategoryFilter = 'all' | 'assigned' | 'unassigned';

@Component({
  selector: 'app-admin-service-structure-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin-service-structure-panel.component.html',
  styleUrl: './admin-service-structure-panel.component.scss',
})
export class AdminServiceStructurePanelComponent {
  @Input() report: AdminServiceStructureReport | null = null;
  @Input() isLoading = false;
  @Input() actionId: string | null = null;
  @Input() searchQuery = '';

  @Output() createCategory = new EventEmitter<AdminCategoryPayload>();
  @Output() updateCategory = new EventEmitter<{
    categoryId: string;
    payload: AdminCategoryPayload;
  }>();
  @Output() disableCategory = new EventEmitter<string>();
  @Output() activateCategory = new EventEmitter<string>();
  @Output() deleteCategoryPermanently = new EventEmitter<string>();
  @Output() bulkCreateCategories = new EventEmitter<AdminCategoryPayload[]>();
  @Output() createSubCategory = new EventEmitter<AdminSubCategoryPayload>();
  @Output() bulkCreateSubCategories = new EventEmitter<AdminSubCategoryPayload[]>();
  @Output() assignSubCategories = new EventEmitter<{
    categoryId: string;
    subCategoryIds: string[];
  }>();
  @Output() deleteSubCategoryPermanently = new EventEmitter<string>();
  @Output() clearSearch = new EventEmitter<void>();

  protected expandedCategoryId: string | null = null;
  protected modalMode: ModalMode = null;
  protected form: CategoryForm = this.emptyForm();
  protected bulkCategoriesText = '';
  protected subCategoryForm: AdminSubCategoryPayload = this.emptySubCategoryForm();
  protected bulkSubCategoriesText = '';
  protected assignmentCategory: AdminServiceStructureCategory | null = null;
  protected categoryPendingDisable: AdminServiceStructureCategory | null = null;
  protected categoryPendingActivation: AdminServiceStructureCategory | null = null;
  protected categoryPendingDelete: AdminServiceStructureCategory | null = null;
  protected subCategoryPendingDelete: AdminServiceSubCategory | null = null;
  protected selectedSubCategoryIds = new Set<string>();
  protected categoryFilter: CategoryFilter = 'all';
  protected subCategoryFilter: SubCategoryFilter = 'all';
  protected readonly iconOptions: IconOption[] = [
    {
      token: 'lucide:wrench',
      icon: 'wrench',
      label: 'Technique',
      keywords: [
        'plomberie',
        'sanitaire',
        'mecanique',
        'reparation',
        'depannage',
        'btp',
        'construction',
        'batiment',
        'artisanat',
      ],
    },
    {
      token: 'lucide:power',
      icon: 'power',
      label: 'Electricite',
      keywords: ['electric', 'energie', 'solaire', 'telecommunication', 'domotique', 'ascenseur'],
    },
    {
      token: 'lucide:stethoscope',
      icon: 'stethoscope',
      label: 'Sante',
      keywords: ['sante', 'medecine', 'medical', 'medecin', 'veterinaire', 'pharmacie'],
    },
    {
      token: 'lucide:heart-pulse',
      icon: 'heart-pulse',
      label: 'Bien-etre',
      keywords: ['beaute', 'bien-etre', 'sport', 'fitness', 'massage'],
    },
    {
      token: 'lucide:map-pinned',
      icon: 'map-pinned',
      label: 'Localisation',
      keywords: ['transport', 'logistique', 'livraison', 'regions', 'chauffeur'],
    },
    {
      token: 'lucide:banknote',
      icon: 'banknote',
      label: 'Finance',
      keywords: ['finance', 'commerce', 'distribution', 'paiement', 'assurance'],
    },
    {
      token: 'lucide:gavel',
      icon: 'gavel',
      label: 'Administratif',
      keywords: ['administratif', 'juridique', 'formalites', 'securite', 'gardiennage'],
    },
    {
      token: 'lucide:users',
      icon: 'users',
      label: 'Personnes',
      keywords: ['personne', 'domicile', 'education', 'formation', 'social'],
    },
    {
      token: 'lucide:smartphone',
      icon: 'smartphone',
      label: 'Digital',
      keywords: ['informatique', 'digital', 'telephone', 'mobile', 'reseau'],
    },
    {
      token: 'lucide:globe-2',
      icon: 'globe-2',
      label: 'General',
      keywords: ['agriculture', 'elevage', 'peche', 'environnement', 'voyage'],
    },
    {
      token: 'lucide:archive',
      icon: 'archive',
      label: 'Materiel',
      keywords: ['stockage', 'materiel', 'menuiserie', 'mobilier'],
    },
    { token: 'lucide:git-fork', icon: 'git-fork', label: 'Structure', keywords: [] },
  ];
  private readonly failedIconUrls = signal<Set<string>>(new Set());

  protected visibleCategories(
    report: AdminServiceStructureReport,
  ): AdminServiceStructureCategory[] {
    return report.categories;
  }

  protected filteredCategories(
    report: AdminServiceStructureReport,
  ): AdminServiceStructureCategory[] {
    const term = this.normalizedSearchQuery();

    return this.visibleCategories(report).filter((category) => {
      if (!this.matchesCategoryFilter(category)) return false;
      if (!term) return true;
      return this.categoryMatchesSearch(category, term);
    });
  }

  protected filteredSubCategories(
    category: AdminServiceStructureCategory,
  ): AdminServiceSubCategory[] {
    const term = this.normalizedSearchQuery();

    return category.subCategories.filter((subCategory) => {
      if (!this.matchesSubCategoryFilter(subCategory)) return false;
      if (!term) return true;
      return this.subCategoryMatchesSearch(subCategory, term);
    });
  }

  protected filteredAvailableSubCategories(
    report: AdminServiceStructureReport,
  ): AdminServiceSubCategory[] {
    const term = this.normalizedSearchQuery();

    return report.availableSubCategories.filter((subCategory) => {
      if (this.subCategoryFilter === 'assigned') return false;
      if (!term) return true;
      return this.subCategoryMatchesSearch(subCategory, term);
    });
  }

  protected filteredCategoryCount(report: AdminServiceStructureReport): number {
    return this.filteredCategories(report).length;
  }

  protected activeFilterCount(): number {
    let count = 0;
    if (this.categoryFilter !== 'all') count += 1;
    if (this.subCategoryFilter !== 'all') count += 1;
    if (this.searchQuery.trim()) count += 1;
    return count;
  }

  protected setCategoryFilter(filter: CategoryFilter): void {
    this.categoryFilter = filter;
  }

  protected setSubCategoryFilter(filter: SubCategoryFilter): void {
    this.subCategoryFilter = filter;
  }

  protected clearFilters(): void {
    this.categoryFilter = 'all';
    this.subCategoryFilter = 'all';
    this.clearSearch.emit();
  }

  protected toggleCategory(categoryId: string): void {
    this.expandedCategoryId = this.expandedCategoryId === categoryId ? null : categoryId;
  }

  protected openCreateForm(): void {
    this.form = this.emptyForm();
    this.form.iconUrl = this.resolveIconTokenForName(this.form.name);
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
    this.selectedSubCategoryIds = new Set(
      category.subCategories.map((subCategory) => subCategory.id),
    );
    this.modalMode = 'assign-subcategories';
  }

  protected closeModal(): void {
    this.modalMode = null;
    this.form = this.emptyForm();
    this.subCategoryForm = this.emptySubCategoryForm();
    this.assignmentCategory = null;
    this.categoryPendingDisable = null;
    this.categoryPendingActivation = null;
    this.categoryPendingDelete = null;
    this.subCategoryPendingDelete = null;
    this.selectedSubCategoryIds.clear();
  }

  protected submitForm(): void {
    const iconUrl =
      !this.form.iconUrl || this.form.iconUrl === 'lucide:git-fork'
        ? this.resolveIconTokenForName(this.form.name)
        : this.form.iconUrl;
    const payload: AdminCategoryPayload = {
      name: this.form.name.trim(),
      iconUrl: iconUrl.trim() || null,
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
      iconUrl: this.resolveIconTokenForName(line),
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
    const payload = this.parseLines(this.bulkSubCategoriesText)
      .map((line, index) => {
        const [name, description] = line.split('|').map((part) => part.trim());
        return {
          name,
          description: description || null,
          sortOrder: index,
        };
      })
      .filter((item) => item.name.length > 0);

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

  protected assignmentOptions(report: AdminServiceStructureReport): AdminServiceSubCategory[] {
    const current = this.assignmentCategory?.subCategories ?? [];
    const byId = new Map<string, AdminServiceSubCategory>();

    [...current, ...report.availableSubCategories].forEach((subCategory) => {
      byId.set(subCategory.id, subCategory);
    });

    return Array.from(byId.values()).sort((first, second) => {
      const sortDelta = first.sortOrder - second.sortOrder;
      return sortDelta !== 0 ? sortDelta : first.name.localeCompare(second.name, 'fr');
    });
  }

  protected filteredAssignmentOptions(
    report: AdminServiceStructureReport,
  ): AdminServiceSubCategory[] {
    const term = this.normalizedSearchQuery();

    return this.assignmentOptions(report).filter((subCategory) => {
      if (!this.matchesSubCategoryFilter(subCategory)) return false;
      if (!term) return true;
      return this.subCategoryMatchesSearch(subCategory, term);
    });
  }

  protected allAssignmentOptionsSelected(report: AdminServiceStructureReport): boolean {
    const options = this.filteredAssignmentOptions(report);
    return (
      options.length > 0 &&
      options.every((subCategory) => this.selectedSubCategoryIds.has(subCategory.id))
    );
  }

  protected selectAllAssignmentOptions(report: AdminServiceStructureReport): void {
    this.selectedSubCategoryIds = new Set(
      this.filteredAssignmentOptions(report).map((subCategory) => subCategory.id),
    );
  }

  protected clearAssignmentSelection(): void {
    this.selectedSubCategoryIds.clear();
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

  protected requestActivate(category: AdminServiceStructureCategory): void {
    if (category.isActive || this.actionId === category.id) return;
    this.categoryPendingActivation = category;
    this.modalMode = 'confirm-activate-category';
  }

  protected confirmActivateCategory(): void {
    if (!this.categoryPendingActivation) return;
    this.activateCategory.emit(this.categoryPendingActivation.id);
    this.closeModal();
  }

  protected canDeleteCategory(category: AdminServiceStructureCategory): boolean {
    return category.declaredServices === 0 && category.subCategories.length === 0;
  }

  protected requestDeleteCategory(category: AdminServiceStructureCategory): void {
    if (!this.canDeleteCategory(category) || this.actionId === category.id) return;
    this.categoryPendingDelete = category;
    this.modalMode = 'confirm-delete-category';
  }

  protected confirmDeleteCategory(): void {
    if (!this.categoryPendingDelete) return;
    this.deleteCategoryPermanently.emit(this.categoryPendingDelete.id);
    this.closeModal();
  }

  protected isSubCategoryAssignedAnywhere(subCategory: AdminServiceSubCategory): boolean {
    return (this.report?.categories ?? []).some((category) =>
      category.subCategories.some((item) => item.id === subCategory.id),
    );
  }

  protected requestDeleteSubCategory(subCategory: AdminServiceSubCategory, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isSubCategoryAssignedAnywhere(subCategory) || this.actionId === subCategory.id) return;
    this.subCategoryPendingDelete = subCategory;
    this.modalMode = 'confirm-delete-subcategory';
  }

  protected confirmDeleteSubCategory(): void {
    if (!this.subCategoryPendingDelete) return;
    this.deleteSubCategoryPermanently.emit(this.subCategoryPendingDelete.id);
    this.closeModal();
  }

  protected subCategoryCount(category: AdminServiceStructureCategory): number {
    return category.subCategories.length;
  }

  protected filteredSubCategoryCount(category: AdminServiceStructureCategory): number {
    return this.filteredSubCategories(category).length;
  }

  protected categoryIconName(category: AdminServiceStructureCategory): string {
    return this.iconNameFromToken(category.iconUrl) || this.iconNameForLabel(category.name);
  }

  protected visibleCategoryIconUrl(category: AdminServiceStructureCategory): string | null {
    const iconUrl = category.iconUrl?.trim();
    if (!iconUrl || this.failedIconUrls().has(iconUrl)) return null;
    if (this.iconNameFromToken(iconUrl)) return null;
    if (this.isLegacyBrokenCdnUrl(iconUrl)) return null;
    return iconUrl;
  }

  protected categoryFormIconName(): string {
    return this.iconNameFromToken(this.form.iconUrl) || this.iconNameForLabel(this.form.name);
  }

  protected selectCategoryIcon(option: IconOption): void {
    this.form.iconUrl = option.token;
  }

  protected isCategoryIconSelected(option: IconOption): boolean {
    return (this.form.iconUrl || this.resolveIconTokenForName(this.form.name)) === option.token;
  }

  protected subCategoryIconName(subCategory: AdminServiceSubCategory): string {
    return this.iconNameForLabel(`${subCategory.name} ${subCategory.description ?? ''}`);
  }

  protected handleCategoryIconError(iconUrl: string): void {
    this.failedIconUrls.update((urls) => {
      const next = new Set(urls);
      next.add(iconUrl);
      return next;
    });
  }

  private isLegacyBrokenCdnUrl(iconUrl: string): boolean {
    try {
      return new URL(iconUrl).hostname === 'cdn.jokko.sn';
    } catch {
      return false;
    }
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

  protected subCategoryTrackBy(_: number, subCategory: AdminServiceSubCategory): string {
    return subCategory.id;
  }

  private matchesCategoryFilter(category: AdminServiceStructureCategory): boolean {
    if (this.categoryFilter === 'active') return category.isActive;
    if (this.categoryFilter === 'inactive') return !category.isActive;
    if (this.categoryFilter === 'with-subcategories') return category.subCategories.length > 0;
    if (this.categoryFilter === 'without-subcategories') return category.subCategories.length === 0;
    if (this.categoryFilter === 'with-services') return category.declaredServices > 0;
    if (this.categoryFilter === 'without-services') return category.declaredServices === 0;
    return true;
  }

  private matchesSubCategoryFilter(subCategory: AdminServiceSubCategory): boolean {
    if (this.subCategoryFilter === 'assigned')
      return this.isSubCategoryAssignedAnywhere(subCategory);
    if (this.subCategoryFilter === 'unassigned')
      return !this.isSubCategoryAssignedAnywhere(subCategory);
    return true;
  }

  private categoryMatchesSearch(category: AdminServiceStructureCategory, term: string): boolean {
    const directValues = [
      category.name,
      String(category.commissionRate),
      String(category.sortOrder),
      category.isActive ? 'active actif disponible' : 'inactive inactif desactive',
    ];

    const branchValues = category.branches.flatMap((branch) => [
      branch.label,
      ...branch.options.flatMap((option) => [
        option.label,
        option.description ?? '',
        String(option.offerCount),
        String(option.minPrice),
        String(option.maxPrice),
      ]),
    ]);

    return (
      [...directValues, ...branchValues].some((value) =>
        this.normalizeSearch(value).includes(term),
      ) ||
      category.subCategories.some((subCategory) => this.subCategoryMatchesSearch(subCategory, term))
    );
  }

  private subCategoryMatchesSearch(subCategory: AdminServiceSubCategory, term: string): boolean {
    return [
      subCategory.name,
      subCategory.description ?? '',
      subCategory.isActive ? 'active actif disponible' : 'inactive inactif',
    ].some((value) => this.normalizeSearch(value).includes(term));
  }

  private normalizedSearchQuery(): string {
    return this.normalizeSearch(this.searchQuery);
  }

  private normalizeSearch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private emptyForm(): CategoryForm {
    return {
      id: null,
      name: '',
      iconUrl: 'lucide:git-fork',
      sortOrder: 0,
      commissionRate: 10,
    };
  }

  private iconNameFromToken(value: string | null | undefined): string | null {
    const token = value?.trim();
    if (!token?.startsWith('lucide:')) return null;
    const iconName = token.slice('lucide:'.length);
    return iconName || null;
  }

  private iconNameForLabel(label: string): string {
    return this.iconNameFromToken(this.resolveIconTokenForName(label)) ?? 'git-fork';
  }

  private resolveIconTokenForName(name: string): `lucide:${string}` {
    const normalized = this.normalizeSearch(name);
    const option = this.iconOptions.find((candidate) =>
      candidate.keywords.some((keyword) => normalized.includes(this.normalizeSearch(keyword))),
    );

    return option?.token ?? 'lucide:git-fork';
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
