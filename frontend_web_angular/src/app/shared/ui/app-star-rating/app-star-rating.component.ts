import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app-star-rating.component.html',
  styleUrl: './app-star-rating.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppStarRatingComponent {
  @Input() value: number | null | undefined = 0;
  @Input() reviews = 0;
  @Input() size: 'small' | 'medium' | 'large' | 'xlarge' = 'medium';
  @Input() label = 'Note';

  protected readonly stars = [1, 2, 3, 4, 5];

  protected get fillPercent(): number {
    const rating = Math.max(0, Math.min(5, Number(this.value) || 0));
    return rating * 20;
  }

  protected get accessibleLabel(): string {
    const rating = Math.max(0, Math.min(5, Number(this.value) || 0));
    const reviews = this.reviews > 0 ? `, ${this.reviews} avis` : '';
    return `${this.label}: ${rating.toFixed(1)} sur 5${reviews}`;
  }
}
