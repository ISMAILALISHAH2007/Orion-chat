import '@/app/styles/globals.css';
import CreatorFooter from '@/app/components/CreatorFooter';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CreatorFooter />
    </>
  );
}