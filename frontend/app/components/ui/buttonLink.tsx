import { VariantProps } from "class-variance-authority";
import { Button, buttonVariants } from "./button";

// React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> &
function ButtonLink({ href, children, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { href: string }) {
    return (
        <a href={href} target='_blank'>
            <Button {...props} size="sm" className='h-6 px-1 py-0 m-0 font-bold '>
                {children}
            </Button>
        </a>
    );
}

export default ButtonLink;