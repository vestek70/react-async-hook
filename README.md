# react-async-hook

Um pequeno hook React **sem dependências externas** para tarefas assíncronas (apenas React como peer dependency).
Seguro contra condições de corrida, com suporte a cancelamento e nova tentativa.

Criei este hook depois de perceber que a primeira versão "funcional" que um assistente de IA me forneceu
tratava apenas o cenário ideal. Este repositório contém a versão que eu realmente usaria em produção.

## Por quê

Um `useFetch` ingênuo pode falhar em produção de formas pouco óbvias:

| Problema | O que acontece |
|---|---|
| Sem estado de erro | A interface pode ficar presa em uma tela vazia |
| Sem cancelamento | `setState` após unmount e requisições desperdiçadas |
| Condição de corrida | Uma resposta lenta de um parâmetro antigo sobrescreve uma resposta mais recente |
| Sem nova tentativa | Qualquer falha temporária de rede vira um beco sem saída |
| Acoplado ao `fetch` | Fica difícil reutilizar e testar |

## Uso

```ts
import { useAsync } from "./src/useAsync";

const { data, status, error, retry } = useAsync(
  (signal) =>
    fetch(`/api/lessons/${id}`, { signal }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<Lesson>;
    }),
  [id]
);
```

## Decisões de design

- **Injeção da tarefa.** O hook não sabe nada sobre `fetch`, autenticação ou URLs base.
  Você fornece uma função, então ele funciona com qualquer tarefa assíncrona e pode ser testado sem mocks globais.
- **Estado com union discriminada.** `success` sempre possui `data`; `error` sempre possui um `Error`.
  Estados impossíveis não podem ser representados.
- **`AbortController`.** Um único mecanismo resolve cancelamento, segurança no unmount e
  condições de corrida: resultados obsoletos são ignorados quando o sinal correspondente já foi abortado.
- **`taskRef`.** Quem usa o hook não precisa envolver a tarefa em `useCallback`.
- **Dados preservados ao recarregar ou em caso de erro.** Evita que a interface volte temporariamente para um estado vazio.

## Testes

```bash
npm install
npm test
npm run typecheck
```

Os testes (Vitest + Testing Library) cobrem sucesso, falha, rejeições que não são instâncias de `Error`,
condição de corrida, cancelamento no unmount, cancelamento ao alterar dependências, preservação de dados e nova tentativa.

## Licença

MIT
