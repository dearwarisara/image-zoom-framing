const PAGE = "__FRAME_HTML_JSON__";

export default {
  async fetch(request) {
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/'){
      return new Response(PAGE,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
    }
    return new Response('Not found',{status:404,headers:{'content-type':'text/plain; charset=utf-8'}});
  }
};
