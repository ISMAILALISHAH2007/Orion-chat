// import { withAuth } from "next-auth/middleware";
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// export default withAuth({
//   pages: {
//     signIn: "/sign-in",
//   },
// });

export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [] // Disable all protections temporarily so user can view the app
};
