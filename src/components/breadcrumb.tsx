type Props = {
  items: [
    // list of parent items with href
    ...{ label: string; href: string }[],
    // last item without href, just label
    { label: string },
  ];
};
export default function Breadcrumb({ items }: Props) {
  return (
    <nav className="text-sm mb-4" aria-label="Breadcrumb">
      <ol className="list-reset flex text-muted-foreground">
        {items.map((item, index) => (
          <li
            key={index}
            className={index === items.length - 1 ? "font-semibold" : ""}
          >
            {index > 0 && <span className="mx-2">/</span>}
            {"href" in item ? (
              <a href={item.href} className="hover:underline">
                {item.label}
              </a>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
