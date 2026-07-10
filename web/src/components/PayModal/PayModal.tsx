import { useEffect, useRef, useState } from 'react';
import { X, Check, Crown, Zap, Code2, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { payApi } from '../../services/api';
import { useUiStore } from '../../stores/ui.store';
import { useAuthStore } from '../../stores/auth.store';
import { PLANS } from '../../constants';

const isMobileWechat = () => /MicroMessenger/i.test(navigator.userAgent);
const isMobile = () => /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);

export default function PayModal() {
  const { setShowPayModal } = useUiStore();
  const { user, fetchProfile } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState('experience');
  const [step, setStep] = useState<'select' | 'pay' | 'success'>('select');
  const [qrUrl, setQrUrl] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWechatQr, setShowWechatQr] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // 是否是 plus/pro 会员（aibook SSO 同步的外部会员等级）
  const isPlusMember = ['pro', 'plus'].includes(user?.plan_type || '');

  const handlePay = async () => {
    setLoading(true);
    try {
      if (isMobileWechat()) {
        // 微信内置浏览器：JSAPI 支付
        const res = await payApi.createJsapi(selectedPlan) as any;
        setOrderNo(res.orderNo);
        const p = res.jsapiParams;
        callWXPay(p, res.orderNo);
      } else if (isMobile()) {
        // 移动端非微信：暂不支持
        alert('请在微信浏览器中打开以使用移动端支付');
        setLoading(false);
        return;
      } else {
        // PC 端：NATIVE 扫码
        const res = await payApi.createNative(selectedPlan) as any;
        const dataUrl = await QRCode.toDataURL(res.codeUrl, { width: 200, margin: 1 });
        setQrUrl(dataUrl);
        setOrderNo(res.orderNo);
        setStep('pay');
        startPolling(res.orderNo);
      }
    } catch (err: any) {
      alert('创建订单失败: ' + (err.message || '请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  const callWXPay = (p: any, orderNo: string) => {
    const doCall = () => {
      (window as any).WeixinJSBridge.invoke('getBrandWCPayRequest', {
        appId: p.appId,
        timeStamp: p.timeStamp,
        nonceStr: p.nonceStr,
        package: p.package,
        signType: p.signType,
        paySign: p.paySign,
      }, (res: any) => {
        if (res.err_msg === 'get_brand_wcpay_request:ok') {
          handlePaySuccess();
        } else if (res.err_msg === 'get_brand_wcpay_request:cancel') {
          alert('已取消支付');
          setLoading(false);
        } else {
          alert('支付失败: ' + res.err_msg);
          setLoading(false);
        }
      });
    };
    if (typeof (window as any).WeixinJSBridge === 'undefined') {
      document.addEventListener('WeixinJSBridgeReady', doCall, false);
    } else {
      doCall();
    }
  };

  const startPolling = (no: string) => {
    pollTimer.current = setInterval(async () => {
      try {
        const res = await payApi.queryStatus(no) as any;
        if (res.status === 'paid') {
          clearInterval(pollTimer.current);
          handlePaySuccess();
        } else if (res.status === 'closed' || res.status === 'failed') {
          clearInterval(pollTimer.current);
          alert('订单已关闭或支付失败');
          setStep('select');
        }
      } catch {
        // 忽略查询错误
      }
    }, 3000);
  };

  const handlePaySuccess = async () => {
    clearInterval(pollTimer.current);
    // 重试 fetchProfile 直到用户权益真正内底已升级（最多等 10s）
    // 防御 queryStatus 返回 "paid" 时 DB 更新尚需一两个简单循环的极少情况
    const prevPlanType = user?.plan_type;
    const prevTokens = user?.tokens_remaining ?? 0;
    for (let i = 0; i < 5; i++) {
      await fetchProfile();
      const latest = useAuthStore.getState().user;
      if (
        latest?.plan_type !== prevPlanType ||
        (latest?.tokens_remaining ?? 0) > prevTokens
      ) break;
      if (i < 4) await new Promise((r) => setTimeout(r, 1500));
    }
    setStep('success');
  };

  useEffect(() => () => clearInterval(pollTimer.current), []);

  const plan = PLANS.find((p) => p.key === selectedPlan)!;

  return (
    <>
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowPayModal(false)}>
      <div className="modal-content max-w-lg">
        <button
          onClick={() => setShowPayModal(false)}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-bg-hover hover:bg-brand-border transition-colors"
        >
          <X size={16} className="text-text-secondary" />
        </button>

        {/* 成功 */}
        {step === 'success' && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">支付成功！</h2>
            <p className="text-text-secondary text-sm mb-6">
              {plan.key === 'experience'
                ? '体验券已到账，快去开始 AI 对话吧 🎉'
                : '整套源码将通过邮件/微信发送给您，感谢支持！'}
            </p>
            <button onClick={() => setShowPayModal(false)} className="btn-primary px-6 py-2.5 text-sm">
              开始使用
            </button>
          </div>
        )}

        {/* 支付中（扫码） */}
        {step === 'pay' && (
          <div className="text-center">
            <h2 className="text-lg font-bold text-text-primary mb-1">微信扫码支付</h2>
            <p className="text-text-secondary text-sm mb-4">
              {plan.name} · <span className="text-brand font-semibold">{plan.price}{plan.period}</span>
            </p>
            <div className="w-[200px] h-[200px] mx-auto mb-4 rounded-[12px] overflow-hidden border border-brand-border">
              {qrUrl && <img src={qrUrl} alt="支付二维码" className="w-full h-full" />}
            </div>
            <p className="text-sm text-text-secondary">请使用微信扫描二维码完成支付</p>
            <p className="text-xs text-text-secondary mt-1 opacity-60">支付完成后自动跳转...</p>
          </div>
        )}

        {/* 选择套餐 */}
        {step === 'select' && (
          <>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Crown size={24} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-text-primary mb-1">选择方案</h2>
              <p className="text-text-secondary text-sm">选择适合你的方案，随时开始</p>
            </div>

            <div className="space-y-3 mb-6">
              {PLANS.map((p) => {
                const Icon = p.key === 'experience' ? Zap : Code2;
                return (
                  <div
                    key={p.key}
                    onClick={() => (p.key === 'source' && isPlusMember) ? setShowWechatQr(true) : setSelectedPlan(p.key)}
                    className={`relative flex gap-4 px-4 py-4 rounded-[14px] border-2 cursor-pointer transition-all
                      ${p.key === 'source' && isPlusMember
                        ? 'border-[#8B5CF6]/40 bg-[#8B5CF6]/5 hover:border-[#8B5CF6]/60'
                        : selectedPlan === p.key
                          ? 'border-brand bg-brand-light'
                          : 'border-brand-border hover:border-brand/40'
                      }`}
                  >
                    {(p as any).recommended && !(p.key === 'source' && isPlusMember) && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white text-[11px] rounded-full font-medium">
                        推荐
                      </span>
                    )}
                    {p.key === 'source' && isPlusMember && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white text-[11px] rounded-full font-medium">
                        已是会员
                      </span>
                    )}
                    {/* 图标 */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: `${p.color}18` }}
                    >
                      <Icon size={18} style={{ color: p.color }} />
                    </div>
                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-sm text-text-primary">{p.name}</span>
                        {p.key === 'source' && isPlusMember
                          ? <QrCode size={16} style={{ color: p.color }} />
                          : <span className="text-lg font-bold" style={{ color: p.color }}>{p.price}</span>
                        }
                      </div>
                      {p.key === 'source' && isPlusMember ? (
                        <p className="text-xs text-[#8B5CF6] font-medium leading-relaxed">
                          您已是 plus 会员，请联系作者获取源码
                        </p>
                      ) : (
                        <ul className="space-y-0.5">
                          {(p as any).features?.map((f: string) => (
                            <li key={f} className="flex items-center gap-1.5 text-xs text-text-secondary">
                              <Check size={10} className="shrink-0" style={{ color: p.color }} />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {!(p.key === 'source' && isPlusMember) && selectedPlan === p.key && (
                      <Check size={16} className="text-brand shrink-0 mt-1" />
                    )}
                  </div>
                );
              })}
            </div>

            {isPlusMember && selectedPlan === 'source' ? (
              <button
                onClick={() => setShowWechatQr(true)}
                className="w-full py-3 text-sm font-semibold rounded-[12px] border-2 border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6]/5 transition-all flex items-center justify-center gap-2"
              >
                <QrCode size={16} />
                联系作者获取源码
              </button>
            ) : (
              <button
                onClick={handlePay}
                disabled={loading}
                className="w-full btn-primary py-3 text-sm font-semibold"
              >
                {loading ? '处理中...' : `立即支付 ${plan.price}`}
              </button>
            )}
            <p className="text-center text-xs text-text-secondary mt-3">
              安全支付由微信提供保障
            </p>
          </>
        )}
      </div>
    </div>

      {/* 作者微信二维码弹窗 */}
      {showWechatQr && (
        <div
          className="modal-overlay"
          onClick={() => setShowWechatQr(false)}
        >
          <div
            className="modal-content max-w-xs text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowWechatQr(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-bg-hover hover:bg-brand-border transition-colors"
            >
              <X size={16} className="text-text-secondary" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#8B5CF6]/10 rounded-xl flex items-center justify-center">
                <QrCode size={16} className="text-[#8B5CF6]" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">联系作者</h3>
            </div>
            <div className="w-44 h-44 rounded-[12px] overflow-hidden border border-brand-border shadow-sm mx-auto mb-3">
              <img
                src="https://next.jitword.com/uploads/WechatIMG246_19d428a664c.jpg"
                alt="微信二维码"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-text-secondary">扫码添加作者微信，备注“源码获取”</p>
          </div>
        </div>
      )}
    </>
  );
}
