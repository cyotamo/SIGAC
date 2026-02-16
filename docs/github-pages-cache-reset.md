# GitHub Pages: limpeza de cache e Service Worker

Se o navegador continuar a redirecionar para domínio antigo (por exemplo `*.web.app`) após deploy no GitHub Pages:

1. Abrir DevTools (`F12`) na página publicada.
2. Ir a **Application** → **Service Workers**.
3. Clicar em **Unregister** no service worker activo.
4. Ir a **Application** → **Storage** (ou **Clear storage**).
5. Clicar em **Clear site data**.
6. Recarregar com hard refresh (`Ctrl+F5`).
7. Repetir o teste em janela normal e anónima.

## Diagnóstico rápido do tipo de redirect

1. Em DevTools, abrir **Network** e activar **Preserve log**.
2. Recarregar a página.
3. Se existir `301/302` no `github.io`, o redirect é de servidor/domínio.
4. Se não existir `301/302` e a URL mudar, o redirect é client-side (HTML/JS/SW).

## Configuração do GitHub Pages

- Verificar se existe ficheiro `CNAME` no repositório (raiz) e se corresponde ao domínio esperado.
- Confirmar em **Settings → Pages** se há **Custom domain** activo.
- Caso exista domínio personalizado, validar se DNS/regras do provedor não redirecionam para `web.app`.
