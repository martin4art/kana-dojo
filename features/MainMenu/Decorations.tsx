'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import themeSets from '@/features/Preferences/data/themes';
import { useClick } from '@/shared/hooks/useAudio';
import clsx from 'clsx';

// Explosion animation styles - only injected once when interactive
const explosionKeyframes = `
@keyframes explode {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(2.4);
    opacity: 0.5;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
}

@keyframes fadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
`;

type DecorationFont = {
  name: string;
  font: {
    className: string;
  };
};

type CharacterStyle = {
  char: string;
  color: string;
  fontClass: string;
  animationDelay: string;
};

type AnimState = 'idle' | 'exploding' | 'hidden' | 'fading-in';

// ============================================================================
// MODULE-LEVEL CACHING - Load once, use forever within session
// ============================================================================

let decorationsCache: string[] | null = null;
let decorationsLoadingPromise: Promise<string[]> | null = null;
let fontsCache: DecorationFont[] | null = null;
let fontsLoadingPromise: Promise<DecorationFont[]> | null = null;
let precomputedStylesCache: CharacterStyle[] | null = null;

// Get all available main colors from themes (computed once at module load)
const allMainColors = (() => {
  const colors = new Set<string>();
  themeSets[2].themes.forEach(theme => {
    colors.add(theme.mainColor);
    if (theme.secondaryColor) colors.add(theme.secondaryColor);
  });
  return Array.from(colors);
})();

// Fisher-Yates shuffle (more efficient than sort-based)
const shuffle = <T,>(arr: T[]): T[] => {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// Load decorations JSON (minimal file with just characters)
const loadDecorations = async (): Promise<string[]> => {
  if (decorationsCache) return decorationsCache;
  if (decorationsLoadingPromise) return decorationsLoadingPromise;

  decorationsLoadingPromise = fetch('/kanji/decorations.json')
    .then(res => res.json())
    .then((chars: string[]) => {
      decorationsCache = shuffle(chars);
      decorationsLoadingPromise = null;
      return decorationsCache;
    });

  return decorationsLoadingPromise;
};

// Load decoration fonts (lazy, only in production)
const loadDecorationFonts = async (
  forceLoad = false
): Promise<DecorationFont[]> => {
  if (process.env.NODE_ENV !== 'production' && !forceLoad) {
    return [];
  }

  if (fontsCache) return fontsCache;
  if (fontsLoadingPromise) return fontsLoadingPromise;

  fontsLoadingPromise = import('./decorationFonts').then(module => {
    fontsCache = module.decorationFonts;
    fontsLoadingPromise = null;
    return module.decorationFonts;
  });

  return fontsLoadingPromise;
};

// Pre-compute all styles once (characters + colors + fonts + delays)
const precomputeStyles = async (
  forceShow = false
): Promise<CharacterStyle[]> => {
  if (precomputedStylesCache) return precomputedStylesCache;

  const [chars, fonts] = await Promise.all([
    loadDecorations(),
    loadDecorationFonts(forceShow)
  ]);

  precomputedStylesCache = chars.map(char => ({
    char,
    color: allMainColors[Math.floor(Math.random() * allMainColors.length)],
    fontClass:
      fonts.length > 0
        ? fonts[Math.floor(Math.random() * fonts.length)].font.className
        : '',
    animationDelay: `${Math.floor(Math.random() * 1000)}ms`
  }));

  return precomputedStylesCache;
};

// ============================================================================
// COMPONENT
// ============================================================================

const Decorations = ({
  expandDecorations,
  forceShow = false,
  interactive = false
}: {
  expandDecorations: boolean;
  forceShow?: boolean;
  interactive?: boolean;
}) => {
  const [styles, setStyles] = useState<CharacterStyle[]>([]);
  const [animStates, setAnimStates] = useState<Map<number, AnimState>>(
    new Map()
  );
  const { playClick } = useClick();

  // Load all data and styles once on mount
  useEffect(() => {
    let isMounted = true;

    precomputeStyles(forceShow).then(computedStyles => {
      if (isMounted) {
        setStyles(computedStyles);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [forceShow]);

  // Memoized explosion handler
  const triggerExplosion = useCallback(
    (index: number) => {
      if (animStates.get(index)) return; // Already animating
      playClick();

      setAnimStates(prev => new Map(prev).set(index, 'exploding'));

      // Animation state transitions
      setTimeout(() => {
        setAnimStates(prev => new Map(prev).set(index, 'hidden'));
        setTimeout(() => {
          setAnimStates(prev => new Map(prev).set(index, 'fading-in'));
          setTimeout(() => {
            setAnimStates(prev => {
              const next = new Map(prev);
              next.delete(index);
              return next;
            });
          }, 500);
        }, 1500);
      }, 300);
    },
    [animStates, playClick]
  );

  // Memoize the animation style getter
  const getAnimationStyle = useCallback(
    (index: number, delay: string): React.CSSProperties => {
      if (!interactive) {
        return { animationDelay: delay };
      }
      const state = animStates.get(index);
      switch (state) {
        case 'exploding':
          return { animation: 'explode 300ms ease-out forwards' };
        case 'hidden':
          return { opacity: 0 };
        case 'fading-in':
          return { animation: 'fadeIn 500ms ease-in forwards' };
        default:
          return {};
      }
    },
    [interactive, animStates]
  );

  // Memoize the grid content to prevent unnecessary re-renders
  const gridContent = useMemo(() => {
    if (styles.length === 0) return null;

    return styles.map((style, index) => {
      const animState = animStates.get(index) ?? 'idle';
      const isClickable = interactive && animState === 'idle';

      return (
        <span
          key={index}
          className={clsx(
            'inline-flex items-center justify-center text-4xl',
            style.fontClass,
            !interactive && 'motion-safe:animate-pulse',
            isClickable && 'cursor-pointer'
          )}
          aria-hidden='true'
          style={{
            color: style.color,
            transformOrigin: 'center center',
            pointerEvents:
              interactive && animState !== 'idle' ? 'none' : undefined,
            ...getAnimationStyle(index, style.animationDelay)
          }}
          onClick={isClickable ? () => triggerExplosion(index) : undefined}
        >
          {style.char}
        </span>
      );
    });
  }, [styles, animStates, interactive, getAnimationStyle, triggerExplosion]);

  if (styles.length === 0) return null;

  return (
    <>
      {interactive && <style>{explosionKeyframes}</style>}
      <div
        className={clsx(
          'fixed inset-0 overflow-hidden',
          expandDecorations ? 'opacity-100' : 'opacity-30',
          interactive ? 'pointer-events-auto' : 'pointer-events-none'
        )}
      >
        <div
          className={clsx(
            'grid h-full w-full gap-0.5 p-2',
            interactive ? 'grid-cols-10 md:grid-cols-28' : 'grid-cols-28'
          )}
        >
          {gridContent}
        </div>
      </div>
    </>
  );
};

export default Decorations;
