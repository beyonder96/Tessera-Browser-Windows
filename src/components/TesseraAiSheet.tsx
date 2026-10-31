import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Key,
  Send,
  Volume2,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import type { AiProviderId, TesseraAiState } from '../shared/types';

interface TesseraAiSheetProps {
  aiState: TesseraAiState;
  onClose: () => void;
  onSelectProvider: (provider: AiProviderId) => void;
  onSaveApiKey: (provider: AiProviderId, key: string) => Promise<void>;
  onGenerateSummary: () => void;
  onAskQuestion: (question: string) => void;
  onListenText: (title: string, text: string) => void;
}

const QUICK_PROMPTS = [
  'Quais são os 3 principais pontos?',
  'Explique de forma simples e direta',
  'Há algum ponto crítico ou alerta?'
];

function renderFormattedMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} style={{ height: 8 }} />;

    const renderBoldSegments = (raw: string) => {
      const parts = raw.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((p, idx) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={idx} style={{ color: 'var(--text-primary)' }}>
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={idx}>{p}</span>
        )
      );
    };

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <div key={i} style={{ display: 'flex', gap: 8, paddingLeft: 4, marginBottom: 5 }}>
          <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>•</span>
          <span style={{ lineHeight: 1.55 }}>{renderBoldSegments(trimmed.slice(2))}</span>
        </div>
      );
    }

    return (
      <p key={i} style={{ lineHeight: 1.6, marginBottom: 6 }}>
        {renderBoldSegments(trimmed)}
      </p>
    );
  });
}

export const TesseraAiSheet: React.FC<TesseraAiSheetProps> = ({
  aiState,
  onClose,
  onSelectProvider,
  onSaveApiKey,
  onGenerateSummary,
  onAskQuestion,
  onListenText
}) => {
  const [question, setQuestion] = useState('');
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  if (!aiState.isVisible) return null;

  const activeHasKey =
    aiState.activeProvider === 'GEMINI' ? aiState.hasGeminiKey : aiState.hasGroqKey;

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveApiKey(aiState.activeProvider, keyInput);
    setKeyInput('');
    setShowKeyConfig(false);
  };

  const handleSendQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || aiState.isAnsweringQuestion) return;
    onAskQuestion(question.trim());
    setQuestion('');
  };

  return (
    <div
      className="modal-animate-in app-no-drag"
      style={{
        position: 'fixed',
        top: 44,
        right: 14,
        bottom: 84,
        width: 410,
        maxWidth: 'calc(100vw - 28px)',
        zIndex: 130,
        borderRadius: 24,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-hairline)',
        boxShadow: 'var(--shadow-floating)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '15px 18px',
          borderBottom: '1px solid var(--border-hairline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 11,
              background: 'rgba(10, 132, 255, 0.16)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Sparkles size={17} />
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>Tessera Intelligence</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              {aiState.pageDomain || 'Assistente Contextual'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setShowKeyConfig((v) => !v)}
            title="Configurar chaves Gemini / Groq (Windows DPAPI)"
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              background: showKeyConfig ? 'var(--accent-primary)' : 'var(--bg-elevated)',
              color: showKeyConfig ? '#FFF' : 'var(--text-secondary)',
              fontSize: 11.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}
          >
            <Key size={13} />
            <span>API</span>
          </button>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'var(--bg-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Provider Switcher */}
      <div
        style={{
          padding: '10px 18px',
          borderBottom: '1px solid var(--border-hairline)',
          display: 'flex',
          gap: 8
        }}
      >
        {(
          [
            { id: 'GEMINI', label: 'Google Gemini Flash', ok: aiState.hasGeminiKey },
            { id: 'GROQ', label: 'Groq (Llama 3.3 70B)', ok: aiState.hasGroqKey }
          ] as Array<{ id: AiProviderId; label: string; ok: boolean }>
        ).map((p) => {
          const active = aiState.activeProvider === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelectProvider(p.id)}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 12,
                background: active ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: active ? '#FFF' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <span>{p.label}</span>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: p.ok ? '#34C759' : 'rgba(255,255,255,0.3)'
                }}
              />
            </button>
          );
        })}
      </div>

      {/* API Key Vault Form */}
      {(showKeyConfig || !activeHasKey) && (
        <form
          onSubmit={handleSaveKey}
          style={{
            padding: '14px 18px',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-hairline)'
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            Chave {aiState.activeProvider === 'GEMINI' ? 'Google AI Studio (Gemini)' : 'Groq Cloud'}{' '}
            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
              (criptografada via Windows DPAPI)
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 12,
                padding: '0 10px'
              }}
            >
              <input
                type={showSecret ? 'text' : 'password'}
                placeholder={activeHasKey ? '•••••••••••••••• (Salva)' : 'Cole sua API Key aqui...'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 12.5,
                  height: 34
                }}
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                style={{ color: 'var(--text-tertiary)' }}
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              type="submit"
              style={{
                padding: '0 14px',
                borderRadius: 12,
                background: 'var(--accent-primary)',
                color: '#FFF',
                fontSize: 12.5,
                fontWeight: 600
              }}
            >
              Salvar
            </button>
          </div>
        </form>
      )}

      {/* Scrollable Summary & Chat Body */}
      <div
        className="selectable-text"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}
      >
        {/* Summary Action / Card */}
        <div
          style={{
            padding: 15,
            borderRadius: 18,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-hairline)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: aiState.summary ? 10 : 0
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent-primary)' }}>
              SÍNTESE DA PÁGINA
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {aiState.summary && (
                <>
                  <button
                    title="Ouvir resumo"
                    onClick={() =>
                      onListenText(`Resumo IA: ${aiState.pageTitle}`, aiState.summary || '')
                    }
                    style={miniActionStyle}
                  >
                    <Volume2 size={13.5} />
                  </button>
                  <button
                    title="Copiar resumo"
                    onClick={() => {
                      void navigator.clipboard.writeText(aiState.summary || '');
                      setCopiedSummary(true);
                      setTimeout(() => setCopiedSummary(false), 1600);
                    }}
                    style={miniActionStyle}
                  >
                    {copiedSummary ? <Check size={13.5} /> : <Copy size={13.5} />}
                  </button>
                </>
              )}
              <button
                onClick={onGenerateSummary}
                disabled={aiState.isSummarizing || !activeHasKey}
                style={{
                  padding: '5px 11px',
                  borderRadius: 999,
                  background: 'var(--accent-primary)',
                  color: '#FFF',
                  fontSize: 11.5,
                  fontWeight: 600,
                  opacity: activeHasKey ? 1 : 0.45,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <RefreshCw size={12} />
                <span>{aiState.isSummarizing ? 'Analisando...' : aiState.summary ? 'Atualizar' : 'Resumir'}</span>
              </button>
            </div>
          </div>

          {aiState.isSummarizing && (
            <div className="pulse-subtle" style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
              Extraindo essência e pontos-chave da página...
            </div>
          )}

          {aiState.summary && !aiState.isSummarizing && (
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              {renderFormattedMarkdown(aiState.summary)}
            </div>
          )}
        </div>

        {aiState.error && (
          <div
            style={{
              padding: '10px 13px',
              borderRadius: 14,
              background: 'rgba(255, 59, 48, 0.14)',
              border: '1px solid rgba(255, 59, 48, 0.35)',
              color: '#FF6B63',
              fontSize: 12.5
            }}
          >
            {aiState.error}
          </div>
        )}

        {/* Quick Question Chips */}
        {aiState.chatMessages.length === 0 && activeHasKey && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                onClick={() => onAskQuestion(q)}
                style={{
                  padding: '6px 11px',
                  borderRadius: 999,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-hairline)',
                  fontSize: 11.5,
                  color: 'var(--text-secondary)'
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Chat Messages */}
        {aiState.chatMessages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              padding: '11px 14px',
              borderRadius: 16,
              background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-elevated)',
              color: msg.role === 'user' ? '#FFFFFF' : 'var(--text-secondary)',
              border: msg.role === 'user' ? 'none' : '1px solid var(--border-hairline)',
              fontSize: 13.2
            }}
          >
            {msg.role === 'user' ? msg.content : renderFormattedMarkdown(msg.content)}
          </div>
        ))}

        {aiState.isAnsweringQuestion && (
          <div
            className="pulse-subtle"
            style={{
              alignSelf: 'flex-start',
              padding: '10px 14px',
              borderRadius: 16,
              background: 'var(--bg-elevated)',
              fontSize: 12.5,
              color: 'var(--text-secondary)'
            }}
          >
            Pensando...
          </div>
        )}
      </div>

      {/* Chat Input Footer */}
      <form
        onSubmit={handleSendQuestion}
        style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--border-hairline)',
          display: 'flex',
          gap: 8
        }}
      >
        <input
          type="text"
          placeholder={activeHasKey ? 'Pergunte sobre esta página...' : 'Configure uma chave API acima'}
          disabled={!activeHasKey}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{
            flex: 1,
            height: 38,
            borderRadius: 19,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-hairline)',
            padding: '0 14px',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={!activeHasKey || !question.trim() || aiState.isAnsweringQuestion}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'var(--accent-primary)',
            color: '#FFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: activeHasKey && question.trim() ? 1 : 0.4
          }}
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};

const miniActionStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-hairline)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
