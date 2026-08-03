export function WaveDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`mp-wave-divider ${className}`} aria-hidden="true">
      {Array.from({ length: 24 }, (_, index) => (
        <span
          key={index}
          style={{
            height: `${22 + ((index * 17) % 76)}%`,
            animationDelay: `${index * 45}ms`,
          }}
        />
      ))}
    </div>
  );
}
