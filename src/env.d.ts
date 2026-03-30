interface ImportMetaEnv {
    //Contentful
    readonly CONTENTFUL_SPACE_ID: string;
    readonly CONTENTFUL_DELIVERY_TOKEN: string;
    readonly CONTENTFUL_PREVIEW_TOKEN: string;

    //Emailjs:
    readonly PUBLIC_EMAILJS_PUBLIC_KEY : string;
    readonly PUBLIC_EMAILJS_SERVICE_ID : string;
    readonly PUBLIC_EMAILJS_TEMPLATE_ID : string;
}

interface ImportMeta{
    readonly env : ImportMetaEnv;
}