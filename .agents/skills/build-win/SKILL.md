---
name: build-win
description: Gera os binários executáveis de produção (Instalador NSIS e Portátil) do Tessera Browser para Windows x64
---

# Build de Produção para Windows

Esta skill empacota e gera os instaladores oficiais do Tessera Browser para Windows.

## Pré-requisitos
- Dependências instaladas (`npm install`).
- Validação estática sem erros (`npm run typecheck`).

## Execução
```powershell
npm run build:win
```

Os artefatos serão gerados no diretório `release/`:
- `release/Tessera-Browser-Setup-<versão>.exe` (Instalador NSIS)
- `release/Tessera-Browser-Portable-<versão>.exe` (Executável Portátil)
