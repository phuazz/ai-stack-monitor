import React,{useRef,useState} from "react";

export default function PowerPointExport({render,name,title,alt,buttonLabel="Export for PowerPoint"}){
  const dialog=useRef(null),artwork=useRef(null);
  const [png,setPng]=useState(""),[status,setStatus]=useState("");

  function open(){
    setStatus("");
    try{artwork.current=render();setPng(artwork.current.toDataURL("image/png"));}
    catch{setPng("");setStatus("The image could not be created. Close the preview and try again.");}
    dialog.current.showModal();
  }
  async function copy(){
    try{
      const blob=new Promise((resolve,reject)=>artwork.current.toBlob(value=>value?resolve(value):reject(new Error("PNG encoding failed")),"image/png"));
      await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);
      setStatus("Image copied. Paste it into PowerPoint.");
    }catch{setStatus("Use Download PNG, or right-click the preview and choose Copy image.");}
  }
  return <><button type="button" className="action" onClick={open}>{buttonLabel}</button>
    <dialog className="heat-export" aria-label={title} ref={dialog} onClose={()=>{artwork.current=null;setPng("");}}>
      <header><h3>{title}</h3>{png&&<><a className="action" href={png} download={name}>Download PNG</a>
        {navigator.clipboard?.write&&typeof ClipboardItem!=="undefined"&&<button type="button" className="action" onClick={copy}>Copy image</button>}</>}
        <button type="button" className="action" onClick={()=>dialog.current.close()}>Close</button></header>
      {status&&<p role="status">{status}</p>}
      {png&&<img src={png} alt={alt}/>}
    </dialog></>;
}
