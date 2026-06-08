const BUTTON_ID = 'analytics-civitai-follow-button';

function getCurrentModelId(): number | undefined {
  const match = window.location.pathname.match(/^\/models\/(\d+)/i);
  if (!match) {
    return undefined;
  }

  return Number(match[1]);
}

function setButtonState(button: HTMLButtonElement, label: string, disabled = false): void {
  button.textContent = label;
  button.disabled = disabled;
  button.style.opacity = disabled ? '0.78' : '1';
}

function createFollowButton(modelId: number): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.textContent = '+ Suivre';
  button.title = 'Ajouter ce modèle à la veille AnalyticsCivitAI';
  button.style.position = 'fixed';
  button.style.right = '18px';
  button.style.bottom = '18px';
  button.style.zIndex = '2147483647';
  button.style.height = '38px';
  button.style.padding = '0 14px';
  button.style.border = '1px solid rgba(255,255,255,0.18)';
  button.style.borderRadius = '6px';
  button.style.background = '#7C3AED';
  button.style.color = '#FFFFFF';
  button.style.font = '600 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  button.style.boxShadow = '0 8px 24px rgba(0,0,0,0.28)';
  button.style.cursor = 'pointer';

  button.addEventListener('click', () => {
    setButtonState(button, 'Ajout...', true);
    chrome.runtime.sendMessage(
      {
        type: 'TRACK_COMPETITOR_MODEL',
        modelId,
        source: 'content-script'
      },
      (response: unknown) => {
        if (chrome.runtime.lastError) {
          setButtonState(button, 'Erreur', false);
          return;
        }

        const result = response as { ok?: boolean; name?: string; error?: string };
        if (result.ok) {
          setButtonState(button, 'Suivi', true);
          return;
        }

        setButtonState(button, result.error ?? 'Erreur', false);
      }
    );
  });

  return button;
}

function refreshTrackedState(button: HTMLButtonElement, modelId: number): void {
  chrome.runtime.sendMessage(
    {
      type: 'IS_MODEL_TRACKED',
      modelId
    },
    (response: unknown) => {
      if (chrome.runtime.lastError) {
        return;
      }

      const result = response as { ok?: boolean; tracked?: boolean };
      if (result.ok && result.tracked) {
        setButtonState(button, '✓ Déjà suivi', true);
        button.title = 'Ce modèle est déjà suivi dans AnalyticsCivitAI';
      }
    }
  );
}

function renderFollowButton(): void {
  const modelId = getCurrentModelId();
  const existingButton = document.getElementById(BUTTON_ID);

  if (!modelId) {
    existingButton?.remove();
    return;
  }

  if (existingButton) {
    return;
  }

  const button = createFollowButton(modelId);
  document.body.append(button);
  refreshTrackedState(button, modelId);
}

let currentPath = window.location.pathname;

renderFollowButton();

window.setInterval(() => {
  if (window.location.pathname === currentPath) {
    return;
  }

  currentPath = window.location.pathname;
  renderFollowButton();
}, 800);
