# Diretrizes de Desenvolvimento — Tessera Browser for Windows

Diretrizes de arquitetura, compilação e qualidade para o Tessera Browser Windows (Electron + React 19 + TypeScript).

---

## 💻 1. Ambiente & Comandos de Desenvolvimento

- **Node.js:** v18+ | **npm:** v9+
- **Desenvolvimento local:**
  ```powershell
  npm run dev
  ```
- **Checagem de Tipos & Testes:**
  ```powershell
  npm run typecheck
  npm run test
  ```
- **Geração de Build/Instalador (Windows x64):**
  ```powershell
  npm run build:win
  ```

---

## ⚡ 2. Diretrizes de Código e Arquitetura

1. **Electron & Segurança:**
   - Comunicação Main <-> Renderer deve passar estritamente pela bridge `contextBridge` / `preload.ts`.
   - Chaves de API e credenciais devem ser criptografadas via `safeStorage` (Windows DPAPI).
   - Sessões e cookies de diferentes Spaces devem ser isolados via partições Chromium dedicadas (`persist:space_<id>`).

2. **React 19 & Performance:**
   - Evitar re-renderizações desnecessárias na AirBar ou no WebView manager.
   - Usar `useCallback` e `useMemo` em manipuladores de eventos de alta frequência (scroll, resize).

3. **Git & Releases:**
   - Commits semânticos (`feat:`, `fix:`, `chore(release): vX.Y.Z`).
   - Publicar release com instalador NSIS e executável portátil:
     ```powershell
     gh release create "vX.Y.Z" "release/Tessera-Browser-Setup-*.exe" "release/Tessera-Browser-Portable-*.exe" --title "vX.Y.Z" --generate-notes
     ```
