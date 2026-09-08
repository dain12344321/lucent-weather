using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// Streams taskbar geometry and no-activation visibility state to Electron.
// All rectangles are native screen pixels; the renderer converts them to DIP.
class Geometry {
 [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
 [StructLayout(LayoutKind.Sequential)] struct MonitorInfo { public int Size; public Rect Monitor, Work; public uint Flags; }

 const uint GA_ROOT=2, GW_HWNDNEXT=2, GW_HWNDPREV=3, DWMWA_CLOAKED=14, DWMWA_EXTENDED_FRAME_BOUNDS=9;
 const uint SWP_NOSIZE=0x0001, SWP_NOMOVE=0x0002, SWP_NOACTIVATE=0x0010;
 const uint SWP_NOOWNERZORDER=0x0200, SWP_NOSENDCHANGING=0x0400;
 static readonly IntPtr HWND_TOPMOST=new IntPtr(-1);

 [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string c,string t);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr parent,IntPtr after,string c,string t);
 [DllImport("user32.dll")] static extern IntPtr GetTopWindow(IntPtr h);
 [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h,uint flags);
 [DllImport("user32.dll",CharSet=CharSet.Auto)] static extern bool GetMonitorInfo(IntPtr h,ref MonitorInfo info);
 [DllImport("user32.dll",EntryPoint="GetWindowLongW")] static extern int GetWindowLong(IntPtr h,int index);
 [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h,uint flags);
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect r);
 [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h,uint command);
 [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
 [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h,uint attribute,out int value,uint size);
 [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h,uint attribute,out Rect value,uint size);
 [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int width,int height,uint flags);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder s,int n);

 static string Json(Rect r){
  return "{\"x\":"+r.Left+",\"y\":"+r.Top+",\"width\":"+(r.Right-r.Left)+",\"height\":"+(r.Bottom-r.Top)+"}";
 }
 static bool Overlap(Rect a,Rect b,out Rect overlap){
  overlap=new Rect{
   Left=Math.Max(a.Left,b.Left),Top=Math.Max(a.Top,b.Top),
   Right=Math.Min(a.Right,b.Right),Bottom=Math.Min(a.Bottom,b.Bottom)
  };
  return overlap.Right>overlap.Left&&overlap.Bottom>overlap.Top;
 }
 static bool BelongsTo(IntPtr hit,IntPtr target){
  if(hit==IntPtr.Zero||target==IntPtr.Zero)return false;
  return hit==target||GetAncestor(hit,GA_ROOT)==target;
 }
 static bool IsCloaked(IntPtr h){
  int value;
  try{return DwmGetWindowAttribute(h,DWMWA_CLOAKED,out value,4)==0&&value!=0;}
  catch{return false;}
 }
 static bool FrameBounds(IntPtr h,out Rect r){
  if(DwmGetWindowAttribute(h,DWMWA_EXTENDED_FRAME_BOUNDS,out r,16)==0&&r.Right>r.Left&&r.Bottom>r.Top)return true;
  return GetWindowRect(h,out r);
 }
 static bool CoversMonitor(Rect front,Rect monitor){
  const int tolerance=2;
  return monitor.Right>monitor.Left&&monitor.Bottom>monitor.Top&&
   front.Left<=monitor.Left+tolerance&&front.Top<=monitor.Top+tolerance&&
   front.Right>=monitor.Right-tolerance&&front.Bottom>=monitor.Bottom-tolerance;
 }
 static string RawClassName(IntPtr h){
  if(h==IntPtr.Zero)return "";
  var s=new StringBuilder(256);GetClassName(h,s,s.Capacity);
  return s.ToString();
 }
 static bool IsShellWindow(IntPtr h,IntPtr taskbar){
  if(BelongsTo(h,taskbar))return true;
  string c=RawClassName(h);
  return c=="Progman"||c=="WorkerW"||c=="Shell_TrayWnd"||c=="Shell_SecondaryTrayWnd";
 }
 static bool ForegroundFullscreen(IntPtr taskbar,IntPtr widget,IntPtr foreground,out Rect front){
  front=new Rect();
  if(foreground==IntPtr.Zero||foreground==widget||IsShellWindow(foreground,taskbar))return false;
  if(!IsWindowVisible(foreground)||IsIconic(foreground)||IsCloaked(foreground))return false;
  if((GetWindowLong(foreground,-20)&0x20)!=0||!FrameBounds(foreground,out front))return false;
  var info=new MonitorInfo();info.Size=Marshal.SizeOf(typeof(MonitorInfo));
  if(!GetMonitorInfo(MonitorFromWindow(taskbar,2),ref info))return false;
  return CoversMonitor(front,info.Monitor);
 }
 static bool FullscreenAboveTaskbar(IntPtr taskbar,IntPtr widget,IntPtr foreground,out Rect front){
  // Active games may use a presentation surface below Explorer's nominal
  // z-order. Keep the foreground check, then inspect background full-monitor
  // windows above the taskbar so a dialog cannot expose a tile over a game.
  if(ForegroundFullscreen(taskbar,widget,foreground,out front))return true;
  IntPtr candidate=GetTopWindow(IntPtr.Zero);
  for(int i=0;i<1024&&candidate!=IntPtr.Zero;i++){
   if(candidate==taskbar)return false;
   Rect candidateBounds;
   if(candidate!=widget&&ForegroundFullscreen(taskbar,widget,candidate,out candidateBounds))return true;
   candidate=GetWindow(candidate,GW_HWNDNEXT);
  }
  return false;
 }
 static bool IsAbove(IntPtr window,IntPtr target){
  IntPtr above=GetWindow(window,GW_HWNDPREV);
  for(int i=0;i<128&&above!=IntPtr.Zero;i++){
   if(above==target)return true;
   above=GetWindow(above,GW_HWNDPREV);
  }
  return false;
 }
 static IntPtr ResolveTaskbar(IntPtr requested,IntPtr widget,bool secondary){
  if(requested!=IntPtr.Zero&&IsWindow(requested))return requested;
  if(!secondary)return FindWindow("Shell_TrayWnd",null);
  IntPtr found=IntPtr.Zero,other=IntPtr.Zero;
  Rect widgetRect;
  bool widgetOk=GetWindowRect(widget,out widgetRect);
  for(int i=0;i<16;i++){
   other=FindWindowEx(IntPtr.Zero,other,"Shell_SecondaryTrayWnd",null);
   if(other==IntPtr.Zero)break;
   if(found==IntPtr.Zero)found=other;
   Rect candidate;
   if(widgetOk&&GetWindowRect(other,out candidate)){
    Rect overlap;
    if(Overlap(widgetRect,candidate,out overlap))return other;
   }
  }
  return found;
 }
 static string ClassName(IntPtr h){
  return RawClassName(h).Replace("\\","\\\\").Replace("\"","\\\"");
 }
 static void WriteUnavailable(StreamWriter output,string secondaryBars){
  output.WriteLine("{\"secondaryBars\":"+secondaryBars+",\"tray\":null,\"fullscreenBlocked\":false,\"taskbarAbove\":false,\"visible\":false,\"frontClass\":\"\",\"bar\":{\"x\":0,\"y\":0,\"width\":0,\"height\":0},\"front\":{\"x\":0,\"y\":0,\"width\":0,\"height\":0}}");
 }

 static void Main(string[] args){
  try{
   int pid;long widgetId;
   if(args.Length<2||!int.TryParse(args[0],out pid)||!long.TryParse(args[1],out widgetId))return;
   IntPtr widget=new IntPtr(widgetId),requested=IntPtr.Zero;
   if(args.Length>2&&!long.TryParse(args[2],out widgetId))return;
   if(args.Length>2)requested=new IntPtr(widgetId);
   var parent=Process.GetProcessById(pid);
   SetProcessDPIAware();
   bool secondary=args.Length>2,raised=false;
   string lastSecondaryBars="[]";
   IntPtr lastTaskbar=IntPtr.Zero;
   using(var output=new System.IO.StreamWriter(Console.OpenStandardOutput(),new UTF8Encoding(false))){
    output.AutoFlush=true;
    while(!parent.HasExited){
     try{
      IntPtr taskbar=ResolveTaskbar(requested,widget,secondary);
      if(taskbar!=lastTaskbar){lastTaskbar=taskbar;raised=false;}
      Rect bar=new Rect();bool barOk=taskbar!=IntPtr.Zero&&GetWindowRect(taskbar,out bar);
      bool visible=barOk&&IsWindowVisible(taskbar);
      IntPtr tray=IntPtr.Zero;
      if(taskbar!=IntPtr.Zero){
       tray=FindWindowEx(taskbar,IntPtr.Zero,"TrayNotifyWnd",null);
       if(tray==IntPtr.Zero)tray=FindWindowEx(taskbar,IntPtr.Zero,"ClockButton",null);
      }
      Rect trayRect=new Rect();bool trayOk=tray!=IntPtr.Zero&&GetWindowRect(tray,out trayRect)&&IsWindowVisible(tray);
      Rect widgetRect=new Rect();bool widgetOk=GetWindowRect(widget,out widgetRect);
      bool widgetVisible=widgetOk&&IsWindowVisible(widget);
      IntPtr fg=GetForegroundWindow();
      Rect front;
      bool fullscreenBlocked=FullscreenAboveTaskbar(taskbar,widget,fg,out front);
      bool taskbarAbove=taskbar!=IntPtr.Zero&&widgetOk&&IsAbove(widget,taskbar);
      if(!widgetVisible||fullscreenBlocked||!taskbarAbove)raised=false;
      else if(!raised)raised=SetWindowPos(widget,HWND_TOPMOST,0,0,0,0,SWP_NOSIZE|SWP_NOMOVE|SWP_NOACTIVATE|SWP_NOOWNERZORDER|SWP_NOSENDCHANGING);
      var bars=new StringBuilder("[");
      if(!secondary){
       IntPtr other=IntPtr.Zero;
       for(int i=0;i<16;i++){
        other=FindWindowEx(IntPtr.Zero,other,"Shell_SecondaryTrayWnd",null);
        if(other==IntPtr.Zero)break;
        if(bars.Length>1)bars.Append(",");
        bars.Append("\"").Append(other.ToInt64()).Append("\"");
       }
      }
      bars.Append("]");
      if(!secondary)lastSecondaryBars=bars.ToString();
      output.WriteLine("{\"secondaryBars\":"+bars+",\"tray\":"+(trayOk?Json(trayRect):"null")+",\"fullscreenBlocked\":"+(fullscreenBlocked?"true":"false")+",\"taskbarAbove\":"+(taskbarAbove?"true":"false")+",\"visible\":"+(visible?"true":"false")+",\"frontClass\":\""+ClassName(fg)+"\",\"bar\":"+Json(bar)+",\"front\":"+Json(front)+"}");
     }catch{
      WriteUnavailable(output,secondary?"[]":lastSecondaryBars);
     }
     Thread.Sleep(500);
    }
   }
  }catch{}
 }
}
