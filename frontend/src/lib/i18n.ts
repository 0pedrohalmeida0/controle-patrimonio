/**
 * Dicionário PT-BR. Mantemos como objeto simples (sem i18n lib) para
 * evitar dependências extras; a string `key` resolve para `value`.
 * Variáveis no formato `{nome}` são interpoladas com o objeto `vars`.
 *
 * Para internacionalizar depois: troque o `default` por um map
 * `Record<Locale, Dict>` e selecione via context.
 */

type Dict = Record<string, string>;

const dict: Dict = {
  // App
  "app.name": "Controle Patrimônio",
  "app.tagline": "Controle de equipamentos físicos",

  // Auth
  "auth.signIn.title": "Entrar",
  "auth.signIn.subtitle": "Use seu e-mail e senha para acessar o sistema.",
  "auth.signIn.submit": "Entrar",
  "auth.signIn.email": "E-mail",
  "auth.signIn.password": "Senha",
  "auth.signIn.signup": "Criar conta",
  "auth.signIn.invalid": "E-mail ou senha incorretos.",
  "auth.signIn.network": "Falha de rede. Verifique sua conexão.",

  "auth.signUp.title": "Criar conta",
  "auth.signUp.subtitle": "Preencha seus dados para se registrar.",
  "auth.signUp.submit": "Cadastrar",
  "auth.signUp.name": "Nome completo",
  "auth.signUp.email": "E-mail",
  "auth.signUp.password": "Senha (mín. 6 caracteres)",
  "auth.signUp.haveAccount": "Já tem conta? Entrar",
  "auth.signUp.success":
    "Conta criada! Se for o primeiro usuário, peça ao administrador para promovê-lo a administrador via SQL.",
  "auth.signUp.emailExists": "Já existe um usuário com este e-mail.",
  "auth.signUp.weakPassword": "Senha muito fraca (mínimo 6 caracteres).",

  "auth.signOut": "Sair",

  // Nav
  "nav.dashboard": "Painel",
  "nav.assets": "Ativos",
  "nav.types": "Tipos",
  "nav.collaborators": "Colaboradores",
  "nav.movements": "Movimentações",
  "nav.problems": "Problemas",
  "nav.indicators": "Indicadores",
  "nav.kiosk": "Quiosque",
  "nav.kioskSetup": "Config. quiosque",
  "nav.users": "Usuários",

  // Kiosk state machine
  "kiosk.title": "Quiosque de autoatendimento",
  "kiosk.idle.title": "Bem-vindo",
  "kiosk.idle.subtitle": "Aproxime o crachá para começar",
  "kiosk.idle.chooseType": "Ou escolha o tipo de equipamento",
  "kiosk.chooseAsset.title": "Escolha o equipamento",
  "kiosk.chooseAsset.empty": "Nenhum equipamento disponível neste tipo.",
  "kiosk.chooseAsset.multi": "Você pode selecionar vários equipamentos",
  "kiosk.badge.title": "Aproxime seu crachá",
  "kiosk.badge.subtitle":
    "Aponte o leitor para o QR do crachá ou digite o número.",
  "kiosk.badge.placeholder": "Número do crachá",
  "kiosk.badge.lookup": "Buscar",
  "kiosk.badge.manual": "Informar nome manualmente",
  "kiosk.badge.manualName": "Nome do responsável",
  "kiosk.confirm.title": "Confirme a retirada",
  "kiosk.confirm.assets": "Equipamento(s)",
  "kiosk.confirm.holder": "Responsável",
  "kiosk.confirm.confirm": "Confirmar",
  "kiosk.confirm.cancel": "Cancelar",
  "kiosk.return.title": "Devolução",
  "kiosk.return.subtitle":
    "Aproxime o equipamento para registrar a devolução.",
  "kiosk.success.title": "Pronto!",
  "kiosk.success.subtitle": "Movimentação registrada com sucesso.",
  "kiosk.success.reset": "Voltar",
  "kiosk.error.assetNotFound": "Equipamento não encontrado.",
  "kiosk.error.assetInUse":
    "Equipamento já está em uso. Devolva-o antes de retirá-lo de novo.",
  "kiosk.error.assetProblem":
    "Equipamento com problema registrado. Comunique o administrador.",
  "kiosk.error.badgeNotFound": "Crachá não encontrado. Tente novamente.",
  "kiosk.error.generic": "Algo deu errado. Tente novamente.",
  "kiosk.error.needHolder": "Informe o nome do responsável.",
  "kiosk.return.confirmTitle": "Devolução confirmada",
  "kiosk.return.success": "Equipamento devolvido com sucesso.",

  // Kiosk setup
  "kioskSetup.title": "Configurar quiosque",
  "kioskSetup.subtitle":
    "Defina o tipo de equipamento que este quiosque gerencia.",
  "kioskSetup.chooseType": "Tipo de equipamento",
  "kioskSetup.label": "Etiqueta deste quiosque",
  "kioskSetup.save": "Salvar",
  "kioskSetup.saved": "Configuração salva.",
  "kioskSetup.qr.title": "QR code do quiosque",
  "kioskSetup.qr.subtitle":
    "Aponte a câmera do celular para abrir este quiosque.",

  // Assets
  "assets.title": "Ativos",
  "assets.subtitle": "Equipamentos cadastrados no sistema.",
  "assets.new": "Novo ativo",
  "assets.search": "Buscar por código ou número…",
  "assets.filter.type": "Tipo",
  "assets.filter.status": "Status",
  "assets.filter.all": "Todos",
  "assets.col.code": "Código",
  "assets.col.type": "Tipo",
  "assets.col.status": "Status",
  "assets.col.holder": "Responsável atual",
  "assets.col.created": "Cadastrado em",
  "assets.col.actions": "Ações",
  "assets.empty": "Nenhum ativo encontrado com os filtros atuais.",
  "assets.detail.title": "Detalhes do ativo",
  "assets.detail.history": "Histórico de movimentações",
  "assets.detail.action.withdraw": "Registrar retirada",
  "assets.detail.action.return": "Registrar devolução",
  "assets.detail.action.returnProblem": "Devolver com problema",
  "assets.detail.created": "Cadastrado em",
  "assets.detail.lastMovement": "Última movimentação",
  "assets.dialog.create": "Cadastrar ativo",
  "assets.dialog.edit": "Editar ativo",
  "assets.dialog.delete": "Remover ativo",
  "assets.dialog.deleteConfirm": "Tem certeza que deseja remover este ativo?",
  "assets.form.type": "Tipo de equipamento",
  "assets.form.number": "Número (ex: 01)",

  // Tipos
  "types.title": "Tipos de equipamento",
  "types.subtitle": "Categorias de ativos (ex: notebook, projetor).",
  "types.new": "Novo tipo",
  "types.col.code": "Código",
  "types.col.name": "Nome",
  "types.col.multi": "Reuso no dia",
  "types.col.actions": "Ações",
  "types.empty": "Nenhum tipo cadastrado.",
  "types.dialog.create": "Novo tipo",
  "types.dialog.edit": "Editar tipo",
  "types.dialog.delete": "Remover tipo",
  "types.dialog.deleteConfirm": "Tem certeza que deseja remover este tipo?",
  "types.form.code": "Código (ex: NTB)",
  "types.form.name": "Nome (ex: Notebook)",
  "types.form.multi": "Permite múltiplas retiradas no mesmo dia",

  // Colaboradores
  "collab.title": "Colaboradores",
  "collab.subtitle": "Pessoas autorizadas a retirar equipamentos.",
  "collab.new": "Novo colaborador",
  "collab.col.name": "Nome",
  "collab.col.badge": "Crachá",
  "collab.col.active": "Ativo",
  "collab.col.actions": "Ações",
  "collab.empty": "Nenhum colaborador cadastrado.",
  "collab.dialog.create": "Novo colaborador",
  "collab.dialog.edit": "Editar colaborador",
  "collab.dialog.delete": "Remover colaborador",
  "collab.dialog.deleteConfirm":
    "Tem certeza que deseja remover este colaborador?",
  "collab.form.name": "Nome completo",
  "collab.form.badge": "Número do crachá",

  // Movimentações
  "mov.title": "Movimentações",
  "mov.subtitle": "Histórico de retiradas e devoluções.",
  "mov.col.when": "Quando",
  "mov.col.asset": "Equipamento",
  "mov.col.type": "Tipo",
  "mov.col.holder": "Responsável",
  "mov.col.note": "Observação",
  "mov.empty": "Nenhuma movimentação no período.",
  "mov.filter.from": "De",
  "mov.filter.to": "Até",
  "mov.filter.asset": "Equipamento",
  "mov.filter.collab": "Colaborador",
  "mov.filter.apply": "Aplicar",
  "mov.filter.clear": "Limpar",
  "mov.type.withdraw": "Retirada",
  "mov.type.return": "Devolução",

  // Problemas
  "problems.title": "Problemas",
  "problems.subtitle": "Equipamentos com avaria registrada.",
  "problems.new": "Registrar problema",
  "problems.col.asset": "Equipamento",
  "problems.col.description": "Descrição",
  "problems.col.status": "Status",
  "problems.col.reportedBy": "Reportado por",
  "problems.col.when": "Quando",
  "problems.empty": "Nenhum problema registrado.",
  "problems.dialog.create": "Registrar problema",
  "problems.dialog.createSub":
    "Aponte qual equipamento apresentou problema e descreva.",
  "problems.form.asset": "Equipamento",
  "problems.form.description": "Descrição",
  "problems.form.reportedBy": "Reportado por",
  "problems.markResolved": "Marcar como resolvido",
  "problems.status.open": "Aberto",
  "problems.status.resolved": "Resolvido",

  // Indicadores
  "indicators.title": "Indicadores",
  "indicators.subtitle": "Métricas operacionais dos últimos dias.",
  "indicators.movLast7": "Movimentações (7 dias)",
  "indicators.movLast30": "Movimentações (30 dias)",
  "indicators.problemsOpen": "Problemas em aberto",
  "indicators.problemsResolved": "Problemas resolvidos",
  "indicators.topAssets": "Top equipamentos mais usados",
  "indicators.range.7d": "7 dias",
  "indicators.range.30d": "30 dias",

  // Usuários
  "users.title": "Usuários",
  "users.subtitle": "Usuários com acesso ao sistema.",
  "users.col.name": "Nome",
  "users.col.email": "E-mail",
  "users.col.role": "Papel",
  "users.col.active": "Ativo",
  "users.col.created": "Criado em",
  "users.col.actions": "Ações",
  "users.empty": "Nenhum usuário cadastrado.",
  "users.changeRole": "Alterar papel",
  "users.deactivate": "Desativar",
  "users.activate": "Reativar",
  "users.role.administrador": "Administrador",
  "users.role.editor": "Editor",
  "users.role.leitor": "Leitor",
  "users.role.kiosk": "Quiosque",

  // Common
  "common.save": "Salvar",
  "common.cancel": "Cancelar",
  "common.delete": "Remover",
  "common.edit": "Editar",
  "common.create": "Criar",
  "common.close": "Fechar",
  "common.confirm": "Confirmar",
  "common.search": "Buscar",
  "common.loading": "Carregando…",
  "common.retry": "Tentar novamente",
  "common.required": "Campo obrigatório",
  "common.yes": "Sim",
  "common.no": "Não",
  "common.back": "Voltar",
  "common.next": "Próximo",
  "common.open": "Abrir",
  "common.unauthorized": "Sessão expirada. Faça login novamente.",
  "common.forbidden": "Você não tem permissão para esta ação.",
  "common.network": "Falha de comunicação com o servidor.",

  // Status
  "status.available": "Disponível",
  "status.in_use": "Em uso",
  "status.problem": "Problema",
};

export type I18nKey = keyof typeof dict | string;

export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = dict[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`,
  );
}

export function hasKey(key: string): boolean {
  return key in dict;
}
