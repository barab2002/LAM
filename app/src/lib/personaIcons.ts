import type { IconName } from '../components/Icon';

/**
 * Maps Style Jury persona names (server-defined in
 * server/src/services/styleJuryService.ts) to a fitting Ionicons glyph.
 * Any persona not in this table falls back to rendering the server's own
 * `emoji` field, so a future roster change never breaks silently.
 */
const PERSONA_ICONS: Record<string, IconName> = {
  Margaux: 'glasses-outline',
  Riley: 'happy-outline',
  Dana: 'briefcase-outline',
  Alex: 'heart-outline',
  Zed: 'flash-outline',
  'Nana Ruth': 'heart-circle-outline',
  Kenji: 'leaf-outline',
};

export function personaIconFor(name: string): IconName | null {
  return PERSONA_ICONS[name] ?? null;
}
