# Arquivo: SQL antigo, NÃO rodar

Scripts soltos de antes de existir `supabase/migrations/00000000_baseline.sql`: correções feitas
direto no SQL Editor, versões antigas de views e funções, o schema inicial. Muitos estão
**desatualizados** — rodar algum deles hoje pode sobrescrever a versão que está valendo.

Ficam aqui só como histórico (de onde veio cada coisa). A estrutura que vale é a do baseline;
mudanças novas viram migrations em `supabase/migrations/`, com rollback em `supabase/rollbacks/`.

Os scripts que apagavam dados de teste (`LIMPAR_DADOS_TESTE.sql`, `limpar_seeds.sql`,
`SETUP_COMPLETO.sql` e afins) foram removidos em 26/10/2026; o histórico do git preserva todos.
