import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getProducts, getCart, addToCart, removeFromCart, checkout } from '../api/store.js'
import { useAuth } from '../context/AuthContext.jsx'
import Card from '../ui/Card.jsx'
import Button from '../ui/Button.jsx'
import { formatCents } from '../lib/format.js'
import { startAction, addActionProperties, endAction, reportError } from '../lib/rum.js'
import ProductImage from '../components/ProductImage.jsx'

function unwrapArray(d) {
  return Array.isArray(d) ? d : d?.items ?? []
}

export default function Store() {
  const { user } = useAuth()
  const citizenId = user?.id
  const qc = useQueryClient()
  const navigate = useNavigate()

  const productsQ = useQuery({ queryKey: ['products'], queryFn: getProducts })
  const cartQ = useQuery({
    queryKey: ['cart', citizenId],
    queryFn: () => getCart(citizenId),
    enabled: !!citizenId,
  })

  const invalidateCart = () => qc.invalidateQueries({ queryKey: ['cart', citizenId] })

  const addMut = useMutation({
    mutationFn: (productId) => {
      const h = startAction('store.add_to_cart')
      addActionProperties(h, { 'product.id': productId })
      return addToCart({ citizenId, productId }).finally(() => endAction(h))
    },
    onError: reportError,
    onSuccess: invalidateCart,
  })

  const removeMut = useMutation({
    mutationFn: (productId) => removeFromCart(citizenId, productId),
    onSuccess: invalidateCart,
  })

  const checkoutMut = useMutation({
    mutationFn: () => {
      const h = startAction('store.checkout')
      return checkout(citizenId)
        .then((order) => {
          addActionProperties(h, { 'order.id': order?.id })
          return order
        })
        .finally(() => endAction(h))
    },
    onError: reportError,
    onSuccess: () => {
      invalidateCart()
      qc.invalidateQueries({ queryKey: ['orders', citizenId] })
      navigate('/store/orders')
    },
  })

  const products = unwrapArray(productsQ.data)
  const cart = cartQ.data || { items: [], item_count: 0, subtotal_cents: 0 }
  const items = cart.items || []
  const busyProduct = addMut.isPending ? addMut.variables : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">City store</h1>
        <p className="text-slate-500 text-sm mt-1">
          Show your Meridian pride. Every checkout is simulated — no payment needed.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {productsQ.isLoading && <p className="text-slate-500">Loading products…</p>}
          {products.map((p) => (
            <Card key={p.id} bodyClassName="!p-4">
              <div className="h-20 rounded-lg bg-slate-50 flex items-center justify-center mb-3">
                <ProductImage imageKey={p.image_key} />
              </div>
              <div className="font-medium text-slate-900">{p.name}</div>
              <div className="text-sm text-slate-500 mb-3">{formatCents(p.price_cents)}</div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => addMut.mutate(p.id)}
                disabled={addMut.isPending && busyProduct === p.id}
              >
                {addMut.isPending && busyProduct === p.id ? 'Adding…' : 'Add to cart'}
              </Button>
            </Card>
          ))}
        </div>

        {/* Cart */}
        <Card title="Your cart" className="h-fit">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Your cart is empty.</p>
          ) : (
            <>
              <div className="-mt-1">
                {items.map((it) => (
                  <div key={it.product_id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-900 truncate">{it.name}</div>
                      <div className="text-xs text-slate-500">Qty {it.quantity}</div>
                    </div>
                    <span className="text-sm text-slate-700">{formatCents(it.line_total_cents)}</span>
                    <button
                      onClick={() => removeMut.mutate(it.product_id)}
                      className="text-slate-400 hover:text-red-600 text-sm"
                      aria-label={`Remove ${it.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 pb-3">
                <span className="text-sm text-slate-500">Subtotal</span>
                <span className="text-xl font-semibold">{formatCents(cart.subtotal_cents)}</span>
              </div>
              <Button
                variant="accent"
                className="w-full"
                onClick={() => checkoutMut.mutate()}
                disabled={checkoutMut.isPending}
              >
                {checkoutMut.isPending ? 'Placing order…' : 'Buy now'}
              </Button>
              <p className="text-xs text-slate-400 text-center mt-2">One click — no card, no address.</p>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
