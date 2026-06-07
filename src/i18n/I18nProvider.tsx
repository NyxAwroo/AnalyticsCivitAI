import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import englishTranslations from './en.json';
import frenchTranslations from './fr.json';
import { getSettings, saveSettings, type Settings } from '../storage/db';

type TranslationMap = Record<string, string>;

interface I18nContextValue {
  language: Settings['language'];
  translations: TranslationMap;
  setLanguage: (language: Settings['language']) => Promise<void>;
  importTranslations: (file: File) => Promise<void>;
  exportTemplate: () => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const dictionaries: Record<'fr' | 'en', TranslationMap> = {
  fr: frenchTranslations,
  en: englishTranslations
};

function isTranslationMap(value: unknown): value is TranslationMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([key, translation]) => typeof key === 'string' && typeof translation === 'string'
  );
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Fichier de langue invalide.'));
    reader.readAsText(file);
  });
}

function downloadJson(filename: string, data: TranslationMap): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function translateNodeText(node: Text, translations: TranslationMap): void {
  const source = node.nodeValue ?? '';
  const trimmed = source.trim();

  if (!trimmed) {
    return;
  }

  const translated = translations[trimmed];
  if (!translated || translated === trimmed) {
    return;
  }

  node.nodeValue = source.replace(trimmed, translated);
}

function translateAttributes(element: Element, translations: TranslationMap): void {
  for (const attribute of ['title', 'aria-label', 'placeholder']) {
    const source = element.getAttribute(attribute);
    if (!source) {
      continue;
    }

    const translated = translations[source.trim()];
    if (translated && translated !== source) {
      element.setAttribute(attribute, translated);
    }
  }
}

function translateDom(root: ParentNode, translations: TranslationMap): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();

  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  for (const textNode of textNodes) {
    translateNodeText(textNode, translations);
  }

  if (root instanceof Element) {
    translateAttributes(root, translations);
  }

  for (const element of root.querySelectorAll?.('[title], [aria-label], [placeholder]') ?? []) {
    translateAttributes(element, translations);
  }
}

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const [settings, setSettings] = useState<Settings | undefined>();
  const observerRef = useRef<MutationObserver | undefined>();

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  const translations = useMemo(() => {
    if (!settings) {
      return dictionaries.fr;
    }

    if (settings.language === 'custom') {
      return { ...dictionaries.fr, ...settings.customTranslations };
    }

    return dictionaries[settings.language];
  }, [settings]);

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) {
      return undefined;
    }

    observerRef.current?.disconnect();
    translateDom(root, translations);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Text) {
            translateNodeText(node, translations);
          } else if (node instanceof Element) {
            translateDom(node, translations);
          }
        }

        if (mutation.type === 'characterData' && mutation.target instanceof Text) {
          translateNodeText(mutation.target, translations);
        }

        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          translateAttributes(mutation.target, translations);
        }
      }
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['title', 'aria-label', 'placeholder']
    });
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [translations]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language: settings?.language ?? 'fr',
      translations,
      t: (key: string) => translations[key] ?? key,
      async setLanguage(language: Settings['language']) {
        const current = settings ?? (await getSettings());
        const next = { ...current, language };
        await saveSettings(next);
        setSettings(next);
      },
      async importTranslations(file: File) {
        const raw = await readFileAsText(file);
        const parsed: unknown = JSON.parse(raw);

        if (!isTranslationMap(parsed)) {
          throw new Error('Fichier de langue invalide.');
        }

        const current = settings ?? (await getSettings());
        const next = {
          ...current,
          language: 'custom' as const,
          customTranslations: parsed
        };
        await saveSettings(next);
        setSettings(next);
      },
      exportTemplate() {
        downloadJson('analytics-civitai-language-template.fr.json', dictionaries.fr);
      }
    }),
    [settings, translations]
  );

  return (
    <I18nContext.Provider value={value}>
      <div key={`${settings?.language ?? 'fr'}-${Object.keys(translations).length}`} className="contents">
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return context;
}
