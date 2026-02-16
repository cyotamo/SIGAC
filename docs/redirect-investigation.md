# Investigação: redirect para `*.web.app` no GitHub Pages

## Causa exacta identificada

O redirecionamento era **client-side** e estava no `index.html` (versão anterior), com lógica equivalente a:

```js
const allowedOrigin = 'https://sigacur00.web.app';
if (window.location.origin !== allowedOrigin && !isLocalhost) {
  window.location.replace('https://sigacur00.web.app/');
}
```

Qualquer origem diferente de `sigacur00.web.app` (incluindo `https://<user>.github.io/<repo>/`) era forçada para Firebase Hosting.

## Correcção aplicada

- Removido o redirect forçado por origem e substituído por geração dinâmica de `canonical`/`og:url` baseada na URL actual.
- URLs de assets no `index.html` passaram a relativas para compatibilidade com GitHub Pages em subpasta.
- Service Worker actualizado para:
  - invalidar cache antigo (`sigac-v2`),
  - usar URLs compatíveis com scope,
  - priorizar rede em navegação para reduzir risco de servir `index.html` antigo.

## Validação recomendada após deploy

1. Testar em janela normal e anónima.
2. DevTools → Network com **Preserve log**:
   - se houver `301/302` no `github.io`: problema de servidor/domínio;
   - sem `301/302` e URL muda: problema client-side.
3. Limpar SW/storage (Application → Service Workers → Unregister; Application → Clear storage → Clear site data) e recarregar.

## Prevenção de regressão

- Script `scripts/check-pages-redirects.sh` falha se detectar `web.app`/`firebaseapp.com` hardcoded nos ficheiros públicos principais.
- Workflow `.github/workflows/guard-pages-redirect.yml` executa esse check em `pull_request` e `push` na branch `main`.
