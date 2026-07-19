// Admin panel — Sprint 2+ (auth-gated with better-auth). The owner uses this
// on a phone, in a stockroom, one-handed: products, inventory, orders.
export default function AdminPage() {
  return (
    <section className="flex flex-col gap-4 p-4">
      <h1 className="text-title">Panel</h1>
      <p className="text-body text-bone/80">
        Productos, inventario y pedidos llegan en los sprints 2 y 4.
      </p>
    </section>
  );
}
