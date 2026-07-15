import { Injectable } from '@angular/core';

export type AppointmentNavigationStep = {
  instruction: string;
  maneuver: string | null;
  distanceMeters: number | null;
  end: { lat: number; lng: number } | null;
};

export type AppointmentNavigationInstruction = {
  instruction: string;
  maneuver: string | null;
  distanceMeters: number | null;
};

@Injectable({ providedIn: 'root' })
export class AppointmentNavigationService {
  private lastSpokenNavigationKey = '';

  findUpcomingStep(
    steps: AppointmentNavigationStep[],
    distanceFromCurrentPosition: (destination: { lat: number; lng: number }) => number,
  ): AppointmentNavigationStep | null {
    if (steps.length === 0) return null;
    const withDistance = steps
      .map((step) => ({
        step,
        distance: step.end
          ? distanceFromCurrentPosition(step.end)
          : Number.POSITIVE_INFINITY,
      }))
      .filter(({ distance }) => Number.isFinite(distance) && distance > 12)
      .sort((left, right) => left.distance - right.distance);
    return withDistance[0]?.step ?? steps[0];
  }

  normalizeInstruction(step: AppointmentNavigationStep): string {
    const instruction = step.instruction.replace(/<[^>]+>/g, '').trim();
    if (instruction) return instruction;

    const maneuver = step.maneuver?.toUpperCase() ?? '';
    if (maneuver.includes('LEFT')) return 'Tournez a gauche.';
    if (maneuver.includes('RIGHT')) return 'Tournez a droite.';
    if (maneuver.includes('UTURN')) return 'Faites demi-tour.';
    if (maneuver.includes('ROUNDABOUT')) return 'Entrez dans le rond-point.';
    return 'Continuez tout droit.';
  }

  resetVoice(): void {
    this.lastSpokenNavigationKey = '';
  }

  cancelVoice(): void {
    if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    }
    this.resetVoice();
  }

  speakInstruction(
    navigation: AppointmentNavigationInstruction,
    distanceLabel: string,
    force = false,
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const key = `${navigation.maneuver ?? 'CONTINUE'}|${navigation.instruction}`;
    if (!force && key === this.lastSpokenNavigationKey) return;

    this.lastSpokenNavigationKey = key;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      navigation.distanceMeters && navigation.distanceMeters > 30
        ? `Dans ${distanceLabel}, ${navigation.instruction}`
        : navigation.instruction,
    );
    utterance.lang = 'fr-FR';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }
}
