import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Cpu, ShoppingCart, ArrowLeft, Plus, Pencil, Trash2, Check, X, Eye, EyeOff, LogOut, AlertTriangle, Ticket, UserPlus, Key, Ban, RotateCcw } from 'lucide-react';
import { userApi, modelApi, payApi, ticketApi } from '../../services/api';
import http from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

type Tab = 'users' | 'models' | 'orders' | 'tickets';

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useAuthStore();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [editingTicket, setEditingTicket] = useState<{ id: number; notes: string } | null>(null);
  const [editingModel, setEditingModel] = useState<any | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<number, boolean>>({});
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  // 本地用户管理
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    nickname: '',
    plan_type: '',
    tokens_remaining: 100000,
    is_admin: 0,
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [resetPwdModal, setResetPwdModal] = useState<{ id: number; username: string; password: string } | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !user?.is_admin) {
      navigate('/admin/login', { replace: true });
    }
  }, [isLoggedIn, user]);

  useEffect(() => {
    if (tab === 'users') {
      userApi.getUsers().then((res: any) => setUsers(res.list || [])).catch(() => {});
    } else if (tab === 'models') {
      modelApi.adminList().then((list: any) => setModels(list || [])).catch(() => {});
    } else if (tab === 'orders') {
      payApi.getAdminOrders().then((res: any) => setOrders(res.list || [])).catch(() => {});
    } else if (tab === 'tickets') {
      ticketApi.getAdminTickets().then((res: any) => setTickets(res.list || [])).catch(() => {});
    }
  }, [tab]);

  const handleSaveModel = async () => {
    if (!editingModel) return;
    try {
      if (editingModel.id) {
        const updated = await modelApi.update(editingModel.id, editingModel) as any;
        setModels((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } else {
        const created = await modelApi.create(editingModel) as any;
        setModels((prev) => [...prev, created]);
      }
      setEditingModel(null);
    } catch {
      alert('保存失败');
    }
  };

  const handleDeleteModel = async (id: number, name: string) => {
    setConfirmDelete({ id, name });
  };

  const doDeleteModel = async () => {
    if (!confirmDelete) return;
    await modelApi.delete(confirmDelete.id);
    setModels((prev) => prev.filter((m) => m.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  const handleToggleUser = async (id: number, field: string, val: any) => {
    const updated = await userApi.updateUser(id, { [field]: val }) as any;
    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
  };

  // 创建本地用户
  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password) {
      alert('账号和密码不能为空');
      return;
    }
    setCreatingUser(true);
    try {
      const res = await http.post('/api/admin/users', newUser) as any;
      if (res.error) {
        alert(res.error);
        return;
      }
      // 刷新用户列表
      const usersRes = await userApi.getUsers() as any;
      setUsers(usersRes.list || []);
      setShowCreateUser(false);
      setNewUser({ username: '', password: '', nickname: '', plan_type: '', tokens_remaining: 100000, is_admin: 0 });
      alert(`用户创建成功！\n\n账号: ${res.username}\n密码: ${newUser.password}\n\n请妥善保管密码`);
    } catch (err: any) {
      alert('创建失败: ' + (err.message || '未知错误'));
    } finally {
      setCreatingUser(false);
    }
  };

  // 重置密码
  const handleResetPassword = async () => {
    if (!resetPwdModal || !resetPwdModal.password) {
      alert('请输入新密码');
      return;
    }
    try {
      const res = await http.post(`/api/admin/users/${resetPwdModal.id}/reset-password`, {
        new_password: resetPwdModal.password,
      }) as any;
      if (res.error) {
        alert(res.error);
        return;
      }
      alert(`密码重置成功！\n\n用户下次登录时需修改密码`);
      setResetPwdModal(null);
    } catch (err: any) {
      alert('重置失败: ' + (err.message || '未知错误'));
    }
  };

  // 禁用/启用用户
  const handleToggleDisabled = async (id: number, isDisabled: boolean) => {
    try {
      const res = await http.patch(`/api/admin/users/${id}/toggle-disabled`, {
        is_disabled: isDisabled,
      }) as any;
      if (res.error) {
        alert(res.error);
        return;
      }
      // 刷新用户列表
      const usersRes = await userApi.getUsers() as any;
      setUsers(usersRes.list || []);
    } catch (err: any) {
      alert('操作失败: ' + (err.message || '未知错误'));
    }
  };

  const tabBtnClass = (t: Tab) =>
    `flex items-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-medium transition-all
    ${tab === t ? 'bg-brand text-white' : 'text-text-secondary hover:bg-brand-light hover:text-brand'}`;

  /** 工单状态文字/颜色映射 */
  const ticketStatusMap: Record<string, { label: string; cls: string }> = {
    pending:  { label: '待处理', cls: 'bg-amber-100 text-amber-700' },
    handling: { label: '处理中', cls: 'bg-blue-100 text-blue-700' },
    resolved: { label: '已解决', cls: 'bg-green-100 text-green-700' },
    closed:   { label: '已关闭', cls: 'bg-gray-100 text-gray-500' },
  };

  const handleUpdateTicket = async (id: number, data: { status?: string; admin_notes?: string }) => {
    const updated = await ticketApi.updateTicket(id, data) as any;
    setTickets((prev) => prev.map((t) => (t.id === id ? updated : t)));
    if (data.admin_notes !== undefined) setEditingTicket(null);
  };

  return (
    <>
    <div className="min-h-screen bg-bg-page">
      {/* 顶部 */}
      <header className="bg-white border-b border-brand-border px-6 py-3 flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-1.5 rounded-lg text-text-secondary hover:text-brand hover:bg-brand-light transition-all"
          title="返回首页"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <img src="/ca/ca2.png" alt="AI 小夕" className="w-6 h-6 object-contain" />
          <h1 className="font-semibold text-text-primary">AI 小夕 · 管理后台</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="px-2 py-1 bg-brand-light text-brand rounded-full font-medium">
            {user?.nickname || '管理员'}
          </span>
          <button
            onClick={() => { logout(); navigate('/admin/login', { replace: true }); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-50 transition-all"
            title="退出登录"
          >
            <LogOut size={13} />
            退出
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Tab */}
        <div className="flex gap-2 mb-6">
          <button className={tabBtnClass('users')} onClick={() => setTab('users')}>
            <Users size={15} /> 用户管理
          </button>
          <button className={tabBtnClass('models')} onClick={() => setTab('models')}>
            <Cpu size={15} /> 模型管理
          </button>
          <button className={tabBtnClass('orders')} onClick={() => setTab('orders')}>
            <ShoppingCart size={15} /> 订单管理
          </button>
          <button className={tabBtnClass('tickets')} onClick={() => setTab('tickets')}>
            <Ticket size={15} /> 工单管理
          </button>
        </div>

        {/* 用户列表 */}
        {tab === 'users' && (
          <div>
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setShowCreateUser(true)}
                className="flex items-center gap-2 btn-primary px-3 py-2 text-xs"
              >
                <UserPlus size={13} /> 创建本地用户
              </button>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="bg-bg-page border-b border-brand-border">
                  <tr>
                    {['ID', '昵称', '账号', '类型', '套餐', 'Token余量', '管理员', '状态', '操作'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-text-secondary font-medium text-xs whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-bg-hover">
                      <td className="px-4 py-3 text-text-secondary text-xs">{u.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {u.avatar && <img src={u.avatar} className="w-6 h-6 rounded-full" alt="" />}
                          <span className="text-xs font-medium">{u.nickname || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">
                        {u.user_type === 'local' ? (
                          <span className="text-brand">{u.username || '-'}</span>
                        ) : (
                          <span className="text-text-secondary">{u.openid?.slice(0, 12)}...</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium
                          ${u.user_type === 'local' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                          {u.user_type === 'local' ? '本地' : 'SSO'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium
                          ${u.is_member ? 'bg-brand-light text-brand' : 'bg-gray-100 text-gray-500'}`}>
                          {u.plan_type || '免费'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">{(u.tokens_remaining / 10000).toFixed(1)}w</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleUser(u.id, 'is_admin', u.is_admin ? 0 : 1)}
                          className={`w-8 h-4 rounded-full transition-all ${u.is_admin ? 'bg-brand' : 'bg-gray-200'}`}
                        >
                          <div className={`w-3 h-3 rounded-full bg-white shadow transition-all mx-0.5 ${u.is_admin ? 'translate-x-4' : ''}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_disabled ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700">禁用</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700">正常</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {u.user_type === 'local' && (
                            <>
                              <button
                                onClick={() => setResetPwdModal({ id: u.id, username: u.username, password: '' })}
                                className="p-1 rounded hover:bg-brand-light text-text-secondary hover:text-brand transition-all"
                                title="重置密码"
                              >
                                <Key size={13} />
                              </button>
                              <button
                                onClick={() => handleToggleDisabled(u.id, !u.is_disabled)}
                                className={`p-1 rounded transition-all ${u.is_disabled ? 'hover:bg-green-50 text-green-600' : 'hover:bg-red-50 text-red-500'}`}
                                title={u.is_disabled ? '启用' : '禁用'}
                              >
                                {u.is_disabled ? <RotateCcw size={13} /> : <Ban size={13} />}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleToggleUser(u.id, 'tokens_remaining', u.tokens_remaining + 100000)}
                            className="text-xs px-2 py-1 rounded-[6px] bg-brand-light text-brand hover:bg-brand/10 transition-colors"
                          >
                            +10w
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 模型管理 */}
        {tab === 'models' && (
          <div>
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setEditingModel({ name: '', provider: 'openai', model_id: '', api_key: '', base_url: '', enabled: 1 })}
                className="flex items-center gap-2 btn-primary px-3 py-2 text-xs"
              >
                <Plus size={13} /> 添加模型
              </button>
            </div>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bg-page border-b border-brand-border">
                  <tr>
                    {['名称', 'Provider', '模型 ID', 'Base URL', 'API Key', '启用', '操作'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-text-secondary font-medium text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {models.map((m) => (
                    <tr key={m.id} className="hover:bg-bg-hover">
                      <td className="px-4 py-3 text-xs font-medium">{m.name}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{m.provider}</td>
                      <td className="px-4 py-3 text-xs font-mono text-text-secondary">{m.model_id}</td>
                      <td className="px-4 py-3 text-xs text-text-secondary truncate max-w-[120px]">{m.base_url || '-'}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-text-secondary">
                            {showApiKey[m.id] ? m.api_key || '-' : (m.api_key ? '•••••••••' : '-')}
                          </span>
                          {m.api_key && (
                            <button onClick={() => setShowApiKey((p) => ({ ...p, [m.id]: !p[m.id] }))}>
                              {showApiKey[m.id] ? <EyeOff size={11} /> : <Eye size={11} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => modelApi.update(m.id, { enabled: m.enabled ? 0 : 1 }).then(() => modelApi.adminList().then((l: any) => setModels(l)))}
                          className={`w-8 h-4 rounded-full transition-all ${m.enabled ? 'bg-brand' : 'bg-gray-200'}`}
                        >
                          <div className={`w-3 h-3 rounded-full bg-white shadow transition-all mx-0.5 ${m.enabled ? 'translate-x-4' : ''}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <button onClick={() => setEditingModel({ ...m })} className="p-1 rounded hover:bg-brand-light text-text-secondary hover:text-brand transition-all">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDeleteModel(m.id, m.name)} className="p-1 rounded hover:bg-red-50 text-text-secondary hover:text-red-500 transition-all">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 订单管理 */}
        {tab === 'orders' && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-page border-b border-brand-border">
                <tr>
                  {['订单号', '用户', '套餐', '金额', '状态', '时间'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-text-secondary font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-bg-hover">
                    <td className="px-4 py-3 text-xs font-mono text-text-secondary">{o.out_trade_no}</td>
                    <td className="px-4 py-3 text-xs">{o.nickname || o.openid?.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-xs">{o.plan_type}</td>
                    <td className="px-4 py-3 text-xs font-medium">¥{(o.amount / 100).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium
                        ${o.status === 'paid' ? 'bg-green-100 text-green-600' :
                          o.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                          'bg-red-100 text-red-600'}`}>
                        {o.status === 'paid' ? '已支付' : o.status === 'pending' ? '待支付' : '失败'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">{o.created_at?.slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 工单管理 */}
        {tab === 'tickets' && (
          <div className="card overflow-hidden">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
              <Ticket size={32} className="mb-3 opacity-30" />
              <p className="text-sm">暂无工单</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bg-page border-b border-brand-border">
                <tr>
                  {['ID', '用户', '情绪', '最后消息', '状态', '时间', '操作'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-text-secondary font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {tickets.map((tk) => {
                  const st = ticketStatusMap[tk.status] ?? { label: tk.status, cls: 'bg-gray-100 text-gray-500' };
                  return (
                    <tr key={tk.id} className="hover:bg-bg-hover">
                      <td className="px-4 py-3 text-xs text-text-secondary">{tk.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {tk.avatar && <img src={tk.avatar} className="w-5 h-5 rounded-full" alt="" />}
                          <span className="text-xs">{tk.nickname || `用户${tk.user_id}`}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          tk.emotion === 'needs_human' ? 'bg-red-100 text-red-600' :
                          tk.emotion === 'negative' ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {tk.emotion === 'needs_human' ? '需人工' : tk.emotion === 'negative' ? '负面' : '中性'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-xs text-text-secondary truncate" title={tk.last_user_message}>
                          {tk.last_user_message || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={tk.status}
                          onChange={(e) => handleUpdateTicket(tk.id, { status: e.target.value })}
                          className={`text-[11px] font-medium px-2 py-1 rounded-full border-0 outline-none cursor-pointer ${st.cls}`}
                        >
                          {Object.entries(ticketStatusMap).map(([v, { label }]) => (
                            <option key={v} value={v}>{label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">{tk.created_at?.slice(0, 16)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setEditingTicket({ id: tk.id, notes: tk.admin_notes || '' })}
                          className="text-xs px-2 py-1 rounded-[6px] bg-brand-light text-brand hover:bg-brand/10 transition-colors"
                        >
                          备注
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      </div>{/* end max-w-6xl */}

      {/* 模型编辑弹窗 */}
      {editingModel && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md">
            <h3 className="text-base font-semibold mb-4">{editingModel.id ? '编辑模型' : '添加模型'}</h3>
            <div className="space-y-3">
              {[
                { key: 'name', label: '模型名称', placeholder: '豆包 Pro' },
                { key: 'provider', label: 'Provider', placeholder: 'doubao/moonshot/deepseek/minimax/qwen' },
                { key: 'model_id', label: '模型 ID', placeholder: 'ep-xxx / moonshot-v1-8k' },
                { key: 'base_url', label: 'Base URL', placeholder: 'https://ark.cn-beijing.volces.com/api/v3' },
                { key: 'api_key', label: 'API Key', placeholder: '输入 API Key' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs text-text-secondary mb-1">{label}</label>
                  <input
                    type={key === 'api_key' ? 'password' : 'text'}
                    value={editingModel[key] || ''}
                    onChange={(e) => setEditingModel((p: any) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full text-sm border border-brand-border rounded-[8px] px-3 py-2 outline-none focus:border-brand bg-bg-page"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSaveModel} className="flex-1 btn-primary py-2 text-sm flex items-center justify-center gap-1">
                <Check size={14} /> 保存
              </button>
              <button onClick={() => setEditingModel(null)} className="flex-1 btn-secondary py-2 text-sm flex items-center justify-center gap-1">
                <X size={14} /> 取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* 删除确认 Modal */}
    {confirmDelete && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-[16px] shadow-modal w-full max-w-sm p-5 animate-fade-in">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-red-50 rounded-[10px] shrink-0">
              <AlertTriangle size={18} className="text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">确认删除模型</p>
              <p className="text-xs text-text-secondary mt-1">将删除模型「{confirmDelete.name}」，删除后无法恢复。</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(null)}
              className="flex-1 py-2.5 text-sm border border-brand-border rounded-[10px] text-text-secondary hover:bg-bg-hover transition-colors font-medium"
            >
              取消
            </button>
            <button
              onClick={doDeleteModel}
              className="flex-1 py-2.5 text-sm bg-red-500 text-white rounded-[10px] hover:bg-red-600 transition-colors font-medium"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 工单备注弹窗 */}
    {editingTicket && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-[16px] shadow-modal w-full max-w-sm p-5 animate-fade-in">
          <h3 className="text-base font-semibold mb-3">工单备注 #{editingTicket.id}</h3>
          <textarea
            value={editingTicket.notes}
            onChange={(e) => setEditingTicket((p) => p ? { ...p, notes: e.target.value } : p)}
            placeholder="输入处理备注..."
            rows={4}
            className="w-full text-sm border border-brand-border rounded-[8px] px-3 py-2 outline-none focus:border-brand bg-bg-page resize-none"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => handleUpdateTicket(editingTicket.id, { admin_notes: editingTicket.notes })}
              className="flex-1 btn-primary py-2 text-sm flex items-center justify-center gap-1"
            >
              <Check size={14} /> 保存
            </button>
            <button
              onClick={() => setEditingTicket(null)}
              className="flex-1 btn-secondary py-2 text-sm flex items-center justify-center gap-1"
            >
              <X size={14} /> 取消
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 创建本地用户弹窗 */}
    {showCreateUser && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-[16px] shadow-modal w-full max-w-md p-5 animate-fade-in">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <UserPlus size={16} className="text-brand" />
            创建本地用户
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">登录账号 *</label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="例如: testuser001"
                className="w-full text-sm border border-brand-border rounded-[8px] px-3 py-2 outline-none focus:border-brand bg-bg-page"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">初始密码 *</label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="至少6位"
                className="w-full text-sm border border-brand-border rounded-[8px] px-3 py-2 outline-none focus:border-brand bg-bg-page"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">昵称</label>
              <input
                type="text"
                value={newUser.nickname}
                onChange={(e) => setNewUser({ ...newUser, nickname: e.target.value })}
                placeholder="默认同账号"
                className="w-full text-sm border border-brand-border rounded-[8px] px-3 py-2 outline-none focus:border-brand bg-bg-page"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">套餐类型</label>
                <select
                  value={newUser.plan_type}
                  onChange={(e) => setNewUser({ ...newUser, plan_type: e.target.value })}
                  className="w-full text-sm border border-brand-border rounded-[8px] px-3 py-2 outline-none focus:border-brand bg-bg-page"
                >
                  <option value="">免费</option>
                  <option value="experience">体验券</option>
                  <option value="source">源码版</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Token 额度</label>
                <input
                  type="number"
                  value={newUser.tokens_remaining}
                  onChange={(e) => setNewUser({ ...newUser, tokens_remaining: Number(e.target.value) })}
                  className="w-full text-sm border border-brand-border rounded-[8px] px-3 py-2 outline-none focus:border-brand bg-bg-page"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_admin"
                checked={newUser.is_admin === 1}
                onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked ? 1 : 0 })}
                className="rounded"
              />
              <label htmlFor="is_admin" className="text-xs text-text-secondary">设为管理员</label>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => setShowCreateUser(false)}
              className="flex-1 py-2.5 text-sm border border-brand-border rounded-[10px] text-text-secondary hover:bg-bg-hover transition-colors font-medium"
              disabled={creatingUser}
            >
              取消
            </button>
            <button
              onClick={handleCreateUser}
              disabled={creatingUser}
              className="flex-1 py-2.5 text-sm bg-brand text-white rounded-[10px] hover:bg-brand/90 transition-colors font-medium disabled:opacity-50"
            >
              {creatingUser ? '创建中...' : '创建用户'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 重置密码弹窗 */}
    {resetPwdModal && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-[16px] shadow-modal w-full max-w-sm p-5 animate-fade-in">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Key size={16} className="text-brand" />
            重置密码
          </h3>
          <p className="text-xs text-text-secondary mb-3">用户：<span className="font-medium text-text-primary">{resetPwdModal.username}</span></p>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">新密码</label>
            <input
              type="password"
              value={resetPwdModal.password}
              onChange={(e) => setResetPwdModal({ ...resetPwdModal, password: e.target.value })}
              placeholder="至少6位"
              className="w-full text-sm border border-brand-border rounded-[8px] px-3 py-2 outline-none focus:border-brand bg-bg-page"
            />
          </div>
          <p className="text-[11px] text-amber-600 mt-2">⚠️ 重置后用户下次登录时需修改密码</p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setResetPwdModal(null)}
              className="flex-1 py-2.5 text-sm border border-brand-border rounded-[10px] text-text-secondary hover:bg-bg-hover transition-colors font-medium"
            >
              取消
            </button>
            <button
              onClick={handleResetPassword}
              className="flex-1 py-2.5 text-sm bg-brand text-white rounded-[10px] hover:bg-brand/90 transition-colors font-medium"
            >
              确认重置
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
