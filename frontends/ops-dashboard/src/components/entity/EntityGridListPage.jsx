import EntityListPage from './EntityListPage.jsx';

export default function EntityGridListPage({ entities }) {
  if (!entities || !Array.isArray(entities)) {
    return <p className="text-gray-500 py-6 text-center">No entity configurations provided.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {entities.map((ent, idx) => (
        <EntityListPage 
          key={ent.id ?? idx} 
          entityType={ent.entityType} 
          fields={ent.fields} 
          filters={ent.filters} 
          label={ent.label} 
        />
      ))}
    </div>
  );
}
