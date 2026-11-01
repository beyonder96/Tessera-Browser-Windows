import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  Check,
  Globe,
  Shield,
  Smartphone,
  Bookmark,
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import QRCode from 'qrcode';
import type { BrowserSettings } from '../shared/types';

interface OnboardingModalProps {
  visible: boolean;
  settings: BrowserSettings;
  onUpdateSettings: (newSettings: Partial<BrowserSettings>) => void;
  onOpenTab: (url: string) => void;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  visible,
  settings,
  onUpdateSettings,
  onOpenTab,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [installedBrowsers, setInstalledBrowsers] = useState<
    Array<{
      id: 'chrome' | 'edge';
      name: string;
      isInstalled: boolean;
      profileName?: string;
      email?: string;
      avatarUrl?: string;
      bookmarkCount: number;
    }>
  >([]);
  const [importedStatus, setImportedStatus] = useState<Record<string, number | null>>({});
  const [googleStatus, setGoogleStatus] = useState<{ isAuthenticated: boolean; email?: string }>({
    isAuthenticated: false
  });
  const [isDefault, setIsDefault] = useState(false);
  const [syncQrDataUrl, setSyncQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!visible) return;

    // 1. Scan installed browsers
    window.tesseraApi?.getInstalledBrowsers?.().then((list) => {
      if (Array.isArray(list)) setInstalledBrowsers(list);
    }).catch(() => {});

    // 2. Check Google auth
    window.tesseraApi?.getGoogleAccountStatus?.().then((res) => {
      if (res) setGoogleStatus(res);
    }).catch(() => {});

    // 3. Default browser status
    window.tesseraApi?.isDefaultBrowser?.().then(setIsDefault).catch(() => {});

    // 4. Generate Sync QR
    window.tesseraApi?.syncGetInfo?.().then(async (info) => {
      if (info?.pairingSecret) {
        const payload = JSON.stringify({
          action: 'tessera_pair',
          version: 2,
          deviceId: info.deviceId,
          deviceName: info.deviceName,
          ip: info.ip || '127.0.0.1',
          port: info.port,
          secret: info.pairingSecret
        });
        const qr = await QRCode.toDataURL(payload, {
          margin: 1,
          width: 140,
          color: { dark: '#000000', light: '#FFFFFF' }
        });
        setSyncQrDataUrl(qr);
      }
    }).catch(() => {});
  }, [visible]);

  if (!visible) return null;

  const handleImportBookmarks = async (browserId: 'chrome' | 'edge') => {
    try {
      const res = await window.tesseraApi?.importBrowserBookmarks?.(browserId);
      if (res) {
        setImportedStatus((prev) => ({ ...prev, [browserId]: res.count }));
      }
    } catch {
      setImportedStatus((prev) => ({ ...prev, [browserId]: 0 }));
    }
  };

  const handleSetDefault = async () => {
    await window.tesseraApi?.setDefaultBrowser?.();
    setIsDefault(true);
  };

  const handleFinish = async () => {
    await window.tesseraApi?.completeOnboarding?.();
    onComplete();
  };

  const chromeInfo = installedBrowsers.find((b) => b.id === 'chrome');

  const steps = [
    { id: 'welcome', title: 'Boas-vindas' },
    { id: 'google', title: 'Conta Google' },
    { id: 'import', title: 'Favoritos' },
    { id: 'privacy', title: 'Proteção' },
    { id: 'sync', title: 'Concluir' }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(5, 5, 8, 0.88)',
        backdropFilter: 'blur(36px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'fadeIn 0.25s ease'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          background: 'var(--bg-elevated, #1A1A1E)',
          borderRadius: 24,
          border: '1px solid var(--border-hairline, rgba(255, 255, 255, 0.08))',
          boxShadow: '0 32px 64px -16px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header / Stepper Bar */}
        <div
          style={{
            padding: '24px 32px 16px',
            borderBottom: '1px solid var(--border-hairline, rgba(255, 255, 255, 0.06))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #FF6B4A 0%, #FFA07A 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(255, 107, 74, 0.35)'
              }}
            >
              <Sparkles size={18} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #FFFFFF)' }}>
                Tessera Browser
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>
                Configuração Inicial • Passo {currentStep + 1} de {steps.length}
              </div>
            </div>
          </div>

          {/* Stepper Dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {steps.map((s, idx) => (
              <div
                key={s.id}
                onClick={() => idx <= currentStep && setCurrentStep(idx)}
                style={{
                  width: idx === currentStep ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background:
                    idx === currentStep
                      ? '#FF6B4A'
                      : idx < currentStep
                      ? 'rgba(255, 107, 74, 0.4)'
                      : 'rgba(255, 255, 255, 0.12)',
                  transition: 'all 0.25s ease',
                  cursor: idx <= currentStep ? 'pointer' : 'default'
                }}
              />
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '32px 36px', minHeight: 340, display: 'flex', flexDirection: 'column' }}>
          {/* STEP 0: Boas-vindas & Tema */}
          {currentStep === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: '#FFF', margin: '0 0 8px' }}>
                  Bem-vindo à sua nova web
                </h2>
                <p style={{ fontSize: 13.5, color: '#AAA', lineHeight: 1.5, margin: 0 }}>
                  O Tessera combina design editorial, alta velocidade com SQLite FTS5 e inteligência artificial
                  integrada. Escolha a sua preferência visual:
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ isDarkMode: true })}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    background: settings.isDarkMode ? 'rgba(255, 107, 74, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1.5px solid ${settings.isDarkMode ? '#FF6B4A' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <Moon size={22} color={settings.isDarkMode ? '#FF6B4A' : '#AAA'} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Tema Escuro (Padrão)</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Conforto visual e elegância editorial</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateSettings({ isDarkMode: false })}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    background: !settings.isDarkMode ? 'rgba(255, 107, 74, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1.5px solid ${!settings.isDarkMode ? '#FF6B4A' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <Sun size={22} color={!settings.isDarkMode ? '#FF6B4A' : '#AAA'} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Tema Claro</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Contraste nítido para leitura diurna</div>
                  </div>
                </button>
              </div>

              {/* Minimalist Switch */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)'
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#FFF' }}>AirBar Inteligente</div>
                  <div style={{ fontSize: 11.5, color: '#888' }}>
                    Oculta automaticamente ao rolar para foco total no conteúdo
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ autoHideAirBar: !settings.autoHideAirBar })}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    background: settings.autoHideAirBar ? '#FF6B4A' : 'rgba(255, 255, 255, 0.1)',
                    color: '#FFF',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {settings.autoHideAirBar ? 'Ativado' : 'Desativado'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: Vínculo com a Conta Google */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: '#FFF', margin: '0 0 8px' }}>
                  Conecte sua Conta Google
                </h2>
                <p style={{ fontSize: 13.5, color: '#AAA', lineHeight: 1.5, margin: 0 }}>
                  Acesse o YouTube, Gmail, Google Drive e seus serviços sem bloqueios. O Tessera possui isolamento de
                  cookies e User-Agent sanitizado compatível com o Google Sign-In.
                </p>
              </div>

              {/* Detected Chrome Account Banner if found */}
              {chromeInfo?.email && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 16,
                    borderRadius: 16,
                    background: 'rgba(66, 133, 244, 0.08)',
                    border: '1.5px solid rgba(66, 133, 244, 0.28)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {chromeInfo.avatarUrl ? (
                      <img
                        src={chromeInfo.avatarUrl}
                        alt="Google Avatar"
                        style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: '#4285F4',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#FFF',
                          fontWeight: 700
                        }}
                      >
                        G
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#FFF' }}>
                        {chromeInfo.profileName || 'Conta Google'}
                      </div>
                      <div style={{ fontSize: 12, color: '#90CAF9' }}>{chromeInfo.email}</div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: '#4285F4',
                      background: 'rgba(66, 133, 244, 0.15)',
                      padding: '4px 10px',
                      borderRadius: 10
                    }}
                  >
                    Detectada no Chrome
                  </span>
                </div>
              )}

              {/* Sign In Options */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 18,
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#FFF' }}>
                    {googleStatus.isAuthenticated ? 'Conta Google Conectada' : 'Fazer login no Google'}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {googleStatus.isAuthenticated
                      ? 'Sessão ativa e protegida. Você já pode usar seus serviços Google.'
                      : 'Abre a página de login oficial do Google para vincular sua conta.'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onOpenTab('https://accounts.google.com/ServiceLogin');
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 12,
                    fontSize: 12.5,
                    fontWeight: 600,
                    background: googleStatus.isAuthenticated ? '#34C759' : '#FFF',
                    color: googleStatus.isAuthenticated ? '#FFF' : '#000',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer'
                  }}
                >
                  {googleStatus.isAuthenticated ? (
                    <>
                      <Check size={14} />
                      Conectado
                    </>
                  ) : (
                    <>
                      <span>Entrar no Google</span>
                      <ExternalLink size={13} />
                    </>
                  )}
                </button>
              </div>

              <div style={{ fontSize: 11.5, color: '#777', lineHeight: 1.4 }}>
                ℹ️ O Tessera não armazena suas credenciais ou senhas: a autenticação é tratada diretamente pelo motor
                seguro do Chromium com cookies isolados por espaço de trabalho.
              </div>
            </div>
          )}

          {/* STEP 2: Importar Favoritos */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: '#FFF', margin: '0 0 8px' }}>
                  Traga seus favoritos
                </h2>
                <p style={{ fontSize: 13.5, color: '#AAA', lineHeight: 1.5, margin: 0 }}>
                  Importe instantaneamente seus sites salvos do Chrome ou Edge para a nova barra de favoritos rápida.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                {installedBrowsers.map((b) => {
                  const importedCount = importedStatus[b.id];
                  const isImported = typeof importedCount === 'number';

                  return (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 20px',
                        borderRadius: 16,
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            background: b.id === 'chrome' ? 'rgba(66, 133, 244, 0.15)' : 'rgba(0, 120, 215, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Bookmark size={20} color={b.id === 'chrome' ? '#4285F4' : '#0078D7'} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#FFF' }}>{b.name}</div>
                          <div style={{ fontSize: 12, color: '#888' }}>
                            {b.bookmarkCount > 0
                              ? `${b.bookmarkCount} favoritos encontrados`
                              : 'Nenhum favorito salvo encontrado'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={b.bookmarkCount === 0 || isImported}
                        onClick={() => handleImportBookmarks(b.id)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 12,
                          fontSize: 12.5,
                          fontWeight: 600,
                          background: isImported ? '#34C759' : b.bookmarkCount > 0 ? '#FF6B4A' : 'rgba(255, 255, 255, 0.08)',
                          color: '#FFF',
                          border: 'none',
                          cursor: b.bookmarkCount > 0 && !isImported ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        {isImported ? (
                          <>
                            <Check size={14} />
                            {importedCount} Importados
                          </>
                        ) : (
                          'Importar'
                        )}
                      </button>
                    </div>
                  );
                })}

                {installedBrowsers.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: '#777', fontSize: 13 }}>
                    Nenhum navegador anterior detectado no Windows. Seus favoritos começarão limpos!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Proteção & IA */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: '#FFF', margin: '0 0 8px' }}>
                  Privacidade Ativa & IA
                </h2>
                <p style={{ fontSize: 13.5, color: '#AAA', lineHeight: 1.5, margin: 0 }}>
                  Navegue com velocidade máxima sem rastreadores, anúncios invasivos ou popups abusivos.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: 16,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <Shield size={24} color="#34C759" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#FFF' }}>Escudo Anti-Anúncios & Trackers</div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        Bloqueia anúncios e rastreadores nativamente via regras cosméticas e DNS
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ adBlockEnabled: !settings.adBlockEnabled })}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      background: settings.adBlockEnabled ? '#34C759' : 'rgba(255, 255, 255, 0.1)',
                      color: '#FFF',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {settings.adBlockEnabled ? 'Ativado' : 'Desativado'}
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: 16,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <Sparkles size={24} color="#FF6B4A" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#FFF' }}>Tessera AI Integrada</div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        Resumo de artigos em 1 clique e menu contextual inteligente
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ tesseraAiEnabled: !settings.tesseraAiEnabled })}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      background: settings.tesseraAiEnabled ? '#FF6B4A' : 'rgba(255, 255, 255, 0.1)',
                      color: '#FFF',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {settings.tesseraAiEnabled ? 'Ativado' : 'Desativado'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Concluir & Conectar ao Mobile */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 700, color: '#FFF', margin: '0 0 8px' }}>
                  Tudo pronto para começar!
                </h2>
                <p style={{ fontSize: 13.5, color: '#AAA', lineHeight: 1.5, margin: 0 }}>
                  Defina o Tessera como seu navegador padrão e conecte ao app do celular na mesma rede Wi-Fi.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
                {/* Default Browser */}
                <div
                  style={{
                    padding: 20,
                    borderRadius: 16,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 16
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Globe size={20} color="#FF6B4A" />
                      <div style={{ fontWeight: 600, fontSize: 15, color: '#FFF' }}>Navegador Padrão</div>
                    </div>
                    <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4 }}>
                      Abra links da web e de outros programas instantaneamente no Tessera.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSetDefault}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 600,
                      background: isDefault ? '#34C759' : '#FFF',
                      color: isDefault ? '#FFF' : '#000',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    {isDefault ? (
                      <>
                        <Check size={16} />
                        Navegador Padrão
                      </>
                    ) : (
                      'Definir como Padrão'
                    )}
                  </button>
                </div>

                {/* Mobile Sync QR Code */}
                <div
                  style={{
                    padding: 18,
                    borderRadius: 16,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 10
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#FFF' }}>Conectar App Android</div>
                  {syncQrDataUrl ? (
                    <img
                      src={syncQrDataUrl}
                      alt="Sync QR Code"
                      style={{ width: 110, height: 110, borderRadius: 10, background: '#FFF', padding: 4 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 110,
                        height: 110,
                        borderRadius: 10,
                        background: 'rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Smartphone size={32} color="#666" />
                    </div>
                  )}
                  <div style={{ fontSize: 10.5, color: '#888' }}>
                    Escaneie pelo menu Desktop Sync do Tessera Android
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '18px 36px',
            borderTop: '1px solid var(--border-hairline, rgba(255, 255, 255, 0.06))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.15)'
          }}
        >
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 600,
                background: 'transparent',
                color: '#AAA',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Voltar
            </button>
          ) : (
            <div />
          )}

          {currentStep < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              style={{
                padding: '10px 22px',
                borderRadius: 12,
                fontSize: 13.5,
                fontWeight: 600,
                background: '#FF6B4A',
                color: '#FFF',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(255, 107, 74, 0.35)'
              }}
            >
              <span>Avançar</span>
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              style={{
                padding: '10px 24px',
                borderRadius: 12,
                fontSize: 13.5,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #FF6B4A 0%, #FFA07A 100%)',
                color: '#FFF',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 16px rgba(255, 107, 74, 0.45)'
              }}
            >
              <span>Começar a Navegar</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
